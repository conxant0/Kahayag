import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicantFormValues } from "../../../../src/features/permits/ApplicantForm";
import { PermitChatSidebar } from "../../../../src/features/permits/PermitChatSidebar";
import { mockPermitAssessmentIncomplete } from "../../../../src/features/permits/fixtures/mockPermitAssessments";
import type { ApplicantAnswers } from "../../../../src/features/permits/permitTypes";

const apiUploadForm = vi.hoisted(() => vi.fn());

vi.mock("../../../../src/shared/api/client", () => ({
  apiUploadForm,
  apiPost: vi.fn(),
  apiGet: vi.fn(),
  apiPostBlob: vi.fn(),
}));

const APPLICANT: ApplicantFormValues = {
  solarInOriginalPermit: "not_sure",
  fullName: "Juan Dela Cruz",
  isRegisteredOwner: "yes",
  registeredOwnerName: "",
  delegatesFilingToRepresentative: false,
};

const UNCHANGED_APPLICANT: ApplicantAnswers = {
  solar_in_original_permit: "not_sure",
  full_name: "Juan Dela Cruz",
  is_registered_owner: true,
  registered_owner_name: null,
  delegates_filing_to_representative: false,
};

function replyWith(reply: string, applicant: ApplicantAnswers = UNCHANGED_APPLICANT) {
  apiUploadForm.mockResolvedValueOnce({
    reply,
    applicant,
    assessment: mockPermitAssessmentIncomplete,
  });
}

function renderSidebar(
  overrides: Partial<Parameters<typeof PermitChatSidebar>[0]> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const props = {
    applicant: APPLICANT,
    onApplicantChange: vi.fn(),
    onAssessmentChange: vi.fn(),
    propertyAddress: "12 Mango Ave, Cebu City",
    systemKwp: 5,
    uploads: new Map<string, File>(),
    buildId: null,
    ...overrides,
  };

  render(
    <QueryClientProvider client={queryClient}>
      <PermitChatSidebar {...props} />
    </QueryClientProvider>,
  );

  return props;
}

async function ask(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByPlaceholderText("Type a question…"), text);
  await user.click(screen.getByRole("button", { name: "Send question" }));
}

beforeEach(() => {
  apiUploadForm.mockReset();
});

describe("PermitChatSidebar", () => {
  it("hides the suggested prompts once the homeowner sends a message", async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByText("What track am I on?")).toBeInTheDocument();

    replyWith("You are on the retrofit track.");
    await ask(user, "What track am I on?");

    await waitFor(() =>
      expect(screen.getByText("You are on the retrofit track.")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Do I need a notarized authorization?" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a rolling transcript capped at 10 messages", async () => {
    const user = userEvent.setup();
    renderSidebar();

    // 6 turns = 12 messages; the first two (question 1 and its reply) fall off.
    for (let index = 1; index <= 6; index += 1) {
      replyWith(`reply ${index}`);
      await ask(user, `question ${index}`);
      await waitFor(() =>
        expect(screen.getByText(`reply ${index}`)).toBeInTheDocument(),
      );
    }

    expect(screen.queryByText("question 1")).not.toBeInTheDocument();
    expect(screen.queryByText("reply 1")).not.toBeInTheDocument();
    expect(screen.getByText("question 2")).toBeInTheDocument();
    expect(screen.getByText("reply 6")).toBeInTheDocument();
  });

  it("does not push an applicant change when the reply left the answers alone", async () => {
    const user = userEvent.setup();
    const { onApplicantChange, onAssessmentChange } = renderSidebar();

    replyWith("A barangay clearance is required under OBO item 12.");
    await ask(user, "Why is the barangay clearance required?");

    await waitFor(() =>
      expect(
        screen.getByText("A barangay clearance is required under OBO item 12."),
      ).toBeInTheDocument(),
    );
    expect(onApplicantChange).not.toHaveBeenCalled();
    expect(onAssessmentChange).toHaveBeenCalledTimes(1);
  });

  it("pushes an applicant change when the reply actually changed an answer", async () => {
    const user = userEvent.setup();
    const { onApplicantChange, onAssessmentChange } = renderSidebar();

    replyWith("Noted — you are not the registered owner.", {
      ...UNCHANGED_APPLICANT,
      is_registered_owner: false,
      registered_owner_name: "Maria Santos",
    });
    await ask(user, "I am not the registered owner, the owner is Maria Santos");

    await waitFor(() => expect(onApplicantChange).toHaveBeenCalledTimes(1));
    expect(onAssessmentChange).toHaveBeenCalledTimes(1);
    expect(onApplicantChange).toHaveBeenCalledWith({
      solarInOriginalPermit: "not_sure",
      fullName: "Juan Dela Cruz",
      isRegisteredOwner: "no",
      registeredOwnerName: "Maria Santos",
      delegatesFilingToRepresentative: false,
    });
  });

  it("sends the uploaded documents so the reply is grounded in the real packet", async () => {
    const user = userEvent.setup();
    const uploads = new Map<string, File>([
      ["obo_14_tct", new File(["x"], "title.pdf", { type: "application/pdf" })],
      ["obo_16_tax_clearance_lot", new File(["y"], "tax_clearance.pdf", { type: "application/pdf" })],
    ]);
    const { onAssessmentChange } = renderSidebar({ uploads, buildId: "build-1" });

    replyWith("Everything on your side is uploaded.");
    await ask(user, "Is my packet complete?");

    await waitFor(() => expect(apiUploadForm).toHaveBeenCalledTimes(1));
    const formData = apiUploadForm.mock.calls[0]![1] as FormData;
    expect(formData.getAll("slot_ids")).toEqual(["obo_14_tct", "obo_16_tax_clearance_lot"]);
    expect(formData.getAll("files")).toHaveLength(2);
    expect(JSON.parse(String(formData.get("request"))).build_id).toBe("build-1");
    expect(onAssessmentChange).toHaveBeenCalledTimes(1);
  });

  it("works before the applicant form has a name on file", async () => {
    const user = userEvent.setup();
    renderSidebar({
      applicant: {
        ...APPLICANT,
        fullName: "",
      },
    });

    replyWith("You are on the retrofit track.");
    await user.click(screen.getByRole("button", { name: "What track am I on?" }));

    await waitFor(() =>
      expect(screen.getByText("You are on the retrofit track.")).toBeInTheDocument(),
    );
    const formData = apiUploadForm.mock.calls[0]![1] as FormData;
    expect(JSON.parse(String(formData.get("request"))).applicant.full_name).toBe("");
  });
});
