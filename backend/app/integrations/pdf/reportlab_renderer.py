from datetime import datetime
from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    CondPageBreak,
    Flowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.features.reports.schemas import (
    GeoPoint,
    ProjectionRow,
    ReportPDFRequest,
    ResolvedReportNarrative,
    SensitivityCase,
)
from app.integrations.maps.static_map import (
    MAP_HEIGHT,
    MAP_WIDTH,
    MAP_ZOOM,
    map_center,
    mercator_pixel,
)

_INK = colors.HexColor("#262A33")
_COBALT = colors.HexColor("#315ACB")
_SUN = colors.HexColor("#F5C84C")
_HAIRLINE = colors.HexColor("#D9D8D2")
_SKY = colors.HexColor("#EEF3FF")
_PAPER = colors.HexColor("#FAFBFD")


def _money(value: int) -> str:
    return f"PHP {value:,.0f}"


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "KahayagTitle",
            parent=base["Title"],
            fontName="Times-Bold",
            fontSize=27,
            leading=31,
            textColor=_INK,
            spaceAfter=10,
        ),
        "heading": ParagraphStyle(
            "KahayagHeading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=19,
            textColor=_COBALT,
            keepWithNext=1,
        ),
        "subheading": ParagraphStyle(
            "KahayagSubheading",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=_COBALT,
            spaceBefore=5,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "KahayagBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13,
            textColor=_INK,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "KahayagSmall",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#5D616D"),
        ),
        "notice": ParagraphStyle(
            "KahayagNotice",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=11,
            textColor=_INK,
        ),
    }


def _table(rows: list[list[str]], *, header: bool = True) -> Table:
    cell_style = ParagraphStyle(
        "KahayagTableCell",
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=_INK,
    )
    header_style = ParagraphStyle(
        "KahayagTableHeader",
        parent=cell_style,
        fontName="Helvetica-Bold",
        textColor=colors.white,
    )
    cells = [
        [
            Paragraph(str(value), header_style if header and row_index == 0 else cell_style)
            for value in row
        ]
        for row_index, row in enumerate(rows)
    ]
    table = Table(
        cells,
        colWidths=[176 * mm / len(rows[0])] * len(rows[0]),
        repeatRows=1 if header else 0,
        hAlign="LEFT",
    )
    commands = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("LEADING", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, -1), _INK),
        ("GRID", (0, 0), (-1, -1), 0.35, _HAIRLINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _PAPER]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), _COBALT),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        )
    table.setStyle(TableStyle(commands))
    return table


def _metric_strip(metrics: list[tuple[str, str]]) -> Table:
    label_style = ParagraphStyle(
        "KahayagMetricLabel",
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=_COBALT,
    )
    value_style = ParagraphStyle(
        "KahayagMetricValue",
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=_INK,
    )
    table = Table(
        [
            [Paragraph(label.upper(), label_style) for label, _value in metrics],
            [Paragraph(value, value_style) for _label, value in metrics],
        ],
        colWidths=[176 * mm / len(metrics)] * len(metrics),
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), _SKY),
                ("GRID", (0, 0), (-1, -1), 0.35, _HAIRLINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def _notice(text: str, styles: dict[str, ParagraphStyle]) -> Table:
    notice = Table(
        [[Paragraph(text, styles["notice"])]],
        colWidths=[176 * mm],
        hAlign="LEFT",
    )
    notice.spaceAfter = 8
    notice.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF1B8")),
                ("BOX", (0, 0), (-1, -1), 0.5, _SUN),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return notice


def _projection_table(projection: tuple[ProjectionRow, ...]) -> list:
    return [
        CondPageBreak(75 * mm),
        _table(
            [["Year", "Generation kWh", "Savings", "Cumulative net"]]
            + [
                [
                    str(row.year),
                    f"{row.generation_kwh}",
                    _money(row.annual_savings_php),
                    _money(row.cumulative_net_php),
                ]
                for row in projection
            ]
        ),
    ]


class _RoofLayout(Flowable):
    def __init__(
        self,
        request: ReportPDFRequest,
        satellite_image: bytes | None,
        *,
        width: float = 165 * mm,
        height: float = 102 * mm,
    ):
        super().__init__()
        self.width = width
        self.height = height
        self.request = request
        self.satellite_image = satellite_image

    def wrap(self, _available_width, _available_height):
        return self.width, self.height

    def _point(self, point: GeoPoint) -> tuple[float, float]:
        if self.satellite_image:
            pixel_x, pixel_y = mercator_pixel(
                point,
                center=map_center(self.request.roof_polygon),
                zoom=MAP_ZOOM,
                width=MAP_WIDTH,
                height=MAP_HEIGHT,
            )
            return pixel_x / MAP_WIDTH * self.width, self.height - pixel_y / MAP_HEIGHT * self.height
        longitudes = [float(item.longitude) for item in self.request.roof_polygon]
        latitudes = [float(item.latitude) for item in self.request.roof_polygon]
        min_longitude, max_longitude = min(longitudes), max(longitudes)
        min_latitude, max_latitude = min(latitudes), max(latitudes)
        x = 12 + (float(point.longitude) - min_longitude) / (max_longitude - min_longitude or 1) * (self.width - 24)
        y = 12 + (float(point.latitude) - min_latitude) / (max_latitude - min_latitude or 1) * (self.height - 24)
        return x, y

    def _polygon(self, corners: tuple[GeoPoint, ...], fill: bool) -> None:
        path = self.canv.beginPath()
        first_x, first_y = self._point(corners[0])
        path.moveTo(first_x, first_y)
        for corner in corners[1:]:
            x, y = self._point(corner)
            path.lineTo(x, y)
        path.close()
        self.canv.drawPath(path, stroke=1, fill=1 if fill else 0)

    def draw(self) -> None:
        if self.satellite_image:
            self.canv.drawImage(
                ImageReader(BytesIO(self.satellite_image)),
                0,
                0,
                width=self.width,
                height=self.height,
            )
        else:
            self.canv.setFillColor(colors.HexColor("#E5E3DF"))
            self.canv.rect(0, 0, self.width, self.height, stroke=0, fill=1)

        self.canv.setStrokeColor(colors.HexColor("#F58C00"))
        self.canv.setFillColor(colors.Color(1, 0.55, 0, alpha=0.22))
        self.canv.setLineWidth(2)
        self._polygon(self.request.roof_polygon, fill=True)
        self.canv.setStrokeColor(_INK)
        self.canv.setFillColor(colors.Color(0.15, 0.16, 0.2, alpha=0.84))
        self.canv.setLineWidth(0.8)
        for panel in self.request.panel_polygons:
            self._polygon(panel.corners, fill=True)
        if not self.satellite_image:
            self.canv.setFillColor(colors.white)
            self.canv.rect(6, self.height - 20, 205, 14, stroke=0, fill=1)
            self.canv.setFillColor(_INK)
            self.canv.setFont("Helvetica", 8)
            self.canv.drawString(10, self.height - 16, "Satellite imagery unavailable - schematic layout shown")
        self.canv.setFillColor(colors.white if self.satellite_image else _INK)
        self.canv.setFont("Helvetica-Bold", 8)
        self.canv.drawString(8, 8, "N")
        self.canv.line(11, 15, 11, 28)


def _page_title(title: str, styles: dict[str, ParagraphStyle]) -> list:
    section = Table(
        [[Paragraph(title, styles["heading"])]],
        colWidths=[176 * mm],
        hAlign="LEFT",
    )
    section.keepWithNext = True
    section.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), _SKY),
                ("LINEBEFORE", (0, 0), (0, 0), 3, _COBALT),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    gap = Spacer(1, 2 * mm)
    gap.keepWithNext = True
    return [section, gap]


def _footer(canvas, document) -> None:
    canvas.saveState()
    canvas.setStrokeColor(_COBALT)
    canvas.line(document.leftMargin, 12 * mm, A4[0] - document.rightMargin, 12 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.HexColor("#5D616D"))
    canvas.drawString(document.leftMargin, 8 * mm, "KAHAYAG | PRELIMINARY SOLAR ASSESSMENT")
    canvas.drawRightString(A4[0] - document.rightMargin, 8 * mm, f"PAGE {document.page}")
    canvas.restoreState()


def render_report_pdf(
    *,
    request: ReportPDFRequest,
    narrative: ResolvedReportNarrative,
    projection: tuple[ProjectionRow, ...],
    sensitivity: tuple[SensitivityCase, ...],
    satellite_image: bytes | None,
    report_id: str,
    generated_at: datetime,
) -> bytes:
    report = request.assessment
    styles = _styles()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=17 * mm,
        leftMargin=17 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Kahayag Solar Brief",
        author="Kahayag",
    )
    story = []

    story.extend(
        [
            Spacer(1, 16 * mm),
            Paragraph("KAHAYAG SOLAR BRIEF", styles["subheading"]),
            Paragraph("A practical starting point for your solar project.", styles["title"]),
            Paragraph(report.property.address, styles["body"]),
            Paragraph(f"Assessment date: {report.property.assessment_date.isoformat()} | Report ID: {report_id}", styles["small"]),
            Spacer(1, 8 * mm),
            _notice("PRELIMINARY ASSESSMENT - INSTALLER VERIFICATION REQUIRED", styles),
            Paragraph(narrative.executive_summary, styles["body"]),
            _metric_strip(
                [
                    (
                        "System",
                        f"{report.recommendation.panel_count} panels / {report.recommendation.system_capacity_kwp} kWp",
                    ),
                    ("Annual generation", f"{report.recommendation.annual_generation_kwh} kWh"),
                    (
                        "Planning cost",
                        f"{_money(report.financials.estimated_cost_low_php)} - {_money(report.financials.estimated_cost_high_php)}",
                    ),
                    ("Simple payback", f"{report.financials.payback_years} years"),
                ]
            ),
            Spacer(1, 4 * mm),
            Paragraph("PROPOSED ROOF LAYOUT", styles["subheading"]),
            _RoofLayout(request, satellite_image, width=176 * mm, height=62 * mm),
            Paragraph(
                f"Illustrative layout with {len(request.panel_polygons)} proposed panels. Installer verification required for final spacing and setbacks.",
                styles["small"],
            ),
            PageBreak(),
        ]
    )

    pages = [
        (
            "Assessment snapshot",
            [
                _table(
                    [
                        ["Input", "Value", "Source"],
                        ["Monthly electricity bill", _money(report.inputs.monthly_bill_php), "User-provided"],
                        ["Monthly consumption", f"{report.inputs.monthly_consumption_kwh} kWh", "Calculated or supplied"],
                        ["Electricity tariff", f"PHP {report.inputs.electricity_rate_php_per_kwh}/kWh", "Assessment input"],
                        ["Budget", _money(report.inputs.budget_php or 0), "User-provided"],
                        ["Usable roof area", f"{report.roof.usable_area_m2} m2", "Roof trace"],
                    ]
                )
            ],
        ),
        (
            "Roof, solar, and shading findings",
            [
                Paragraph(narrative.technical_explanation, styles["body"]),
                _table(
                    [
                        ["Measure", "Value"],
                        ["Solar resource", report.assumptions.solar_resource_source],
                        ["Performance ratio", str(report.assumptions.performance_ratio)],
                        ["Annual sunshine", f"{report.assumptions.annual_sunshine_hours_per_kwp} hours/kWp"],
                        ["Shading", report.shading.shading_impact if report.shading else "Not assessed"],
                    ]
                ),
            ],
        ),
        (
            "Preliminary system schedule",
            [
                _table(
                    [
                        ["Item", "Preliminary guidance"],
                        ["PV modules", f"{report.recommendation.panel_count} x {report.recommendation.panel_wattage_w} W, brand-neutral"],
                        ["DC capacity", f"{report.recommendation.system_capacity_kwp} kWp"],
                        ["Panel footprint", f"{report.assumptions.panel_width_m} m x {report.assumptions.panel_height_m} m"],
                        ["Inverter", "Brand-neutral AC capacity to be finalized by installer"],
                        ["Monitoring", "Confirm monitoring connectivity and equipment scope"],
                    ]
                ),
                Paragraph("Final electrical design, inverter selection, protection devices, grounding, and mounting system remain installer responsibilities.", styles["body"]),
            ],
        ),
        (
            "Energy analysis",
            [
                _table(
                    [
                        ["Measure", "Estimate"],
                        ["Annual consumption", f"{Decimal(report.inputs.monthly_consumption_kwh) * 12} kWh"],
                        ["Annual solar production", f"{report.recommendation.annual_generation_kwh} kWh"],
                        ["Consumption offset", f"{report.recommendation.annual_consumption_offset_ratio * 100}%"],
                        ["Annual savings", _money(report.financials.annual_savings_php)],
                        ["Monthly savings", _money(report.financials.monthly_savings_php)],
                    ]
                ),
                Paragraph("Hourly household load behavior was not measured. Actual self-consumption and exported energy require installer and utility verification.", styles["body"]),
            ],
        ),
        (
            "Cost and payback",
            [
                Paragraph(narrative.financial_explanation, styles["body"]),
                _table(
                    [
                        ["Scenario", "Planning value"],
                        ["Low installed cost", _money(report.financials.estimated_cost_low_php)],
                        ["Base installed cost", _money(report.financials.estimated_base_cost_php)],
                        ["High installed cost", _money(report.financials.estimated_cost_high_php)],
                        ["Simple payback", f"{report.financials.payback_years} years"],
                        ["Budget compatibility", "Yes" if report.financials.budget_compatible else "No"],
                    ]
                ),
                _notice("This section is a planning estimate, not an itemized contractor quotation.", styles),
            ],
        ),
        (
            "Twenty-five-year demo scenario",
            [
                Paragraph("Illustrative scenario: 0.5% annual panel degradation, flat electricity prices, and no modeled maintenance, replacement, financing, tax, inflation, or discounting.", styles["body"]),
                *_projection_table(projection),
            ],
        ),
        (
            "Sensitivity summary",
            [
                _table(
                    [["Case", "Generation", "Installed cost", "Simple payback", "Year 25 net"]]
                    + [[case.label, f"{case.generation_ratio * 100}%", f"{case.installed_cost_ratio * 100}%", f"{case.payback_years} years" if case.payback_years is not None else "Not available", _money(case.year_25_net_php)] for case in sensitivity]
                )
            ],
        ),
        (
            "Contractor observations and priorities",
            [Paragraph(observation, styles["body"]) for observation in narrative.contractor_observations],
        ),
        (
            "Site-survey checklist",
            [
                Paragraph(
                    "<br/>".join(
                        f"[ ] {item}"
                        for item in (
                            "Roof condition and measurements",
                            "Obstructions and required setbacks",
                            "Structural suitability",
                            "Service voltage and phase",
                            "Panelboard and available breakers",
                            "Grounding and surge protection",
                            "Cable route and inverter location",
                            "Meter and utility interconnection requirements",
                            "Monitoring connectivity",
                        )
                    ),
                    styles["body"],
                ),
            ],
        ),
        (
            "Contractor deliverables checklist",
            [
                Paragraph(
                    "<br/>".join(
                        f"[ ] {item}"
                        for item in (
                            "Final equipment schedule and panel layout",
                            "Structural and electrical design",
                            "Single-line diagram",
                            "Itemized quotation and warranty terms",
                            "Permit and utility scope",
                            "Installation schedule and payment milestones",
                            "Exclusions and change-order terms",
                        )
                    ),
                    styles["body"],
                ),
            ],
        ),
        (
            "Assumptions, limitations, and environmental note",
            [
                Paragraph(f"Estimated annual avoided emissions: {(report.recommendation.annual_generation_kwh * Decimal('0.444') / 1000).quantize(Decimal('0.1'))} tonnes CO2e. This uses the fixed Kahayag demo factor of 0.444 kg CO2e per kWh.", styles["body"]),
                _notice("Professional verification is required for property conditions, roof structure, equipment design, permits, utility requirements, and final quotation.", styles),
                _table([["Assumption", "Value"]] + [["Limitation", limitation] for limitation in report.limitations]),
                Paragraph(f"Generated {generated_at.date().isoformat()} | {report_id}", styles["small"]),
            ],
        ),
    ]
    page_break_before = {
        "Assumptions, limitations, and environmental note",
    }
    for title, content in pages:
        if title in page_break_before:
            story.append(PageBreak())
        story.extend(_page_title(title, styles))
        story.extend(content)
        story.append(Spacer(1, 6 * mm))

    document.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
