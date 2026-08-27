import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../../App";
import { calculateComparison } from "../../domain/comparison";
import { buildSampleComparisonInput } from "./fixtures";
import { formatUsd } from "./money";

afterEach(() => {
  cleanup();
});

function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe("sample routing", () => {
  it("S2.1: Try the sample navigates to /sample", async () => {
    const user = userEvent.setup();
    renderApp("/");

    await user.click(screen.getByRole("link", { name: "Try the sample" }));

    expect(
      screen.getByRole("heading", { name: /sample comparison/i }),
    ).toBeInTheDocument();
  });
});

describe("sample comparison", () => {
  it("S2.2: shows UCSD and Loyola totals from calculateComparison", () => {
    renderApp("/sample");

    expect(
      within(screen.getByTestId("offer-card-ucsd")).getByRole("heading", {
        name: "UC San Diego",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("offer-card-loyola")).getByRole("heading", {
        name: "Loyola University Maryland",
      }),
    ).toBeInTheDocument();

    const giftRow = screen.getByTestId("comparison-row-gift_aid");
    expect(within(giftRow).getByText("$25,000.00")).toBeInTheDocument();
    expect(within(giftRow).getByText("$17,000.00")).toBeInTheDocument();

    const loanRow = screen.getByTestId("comparison-row-student_loans");
    expect(within(loanRow).getByText("$0.00")).toBeInTheDocument();
    expect(within(loanRow).getByText("$7,500.00")).toBeInTheDocument();

    const wsRow = screen.getByTestId("comparison-row-work_study");
    expect(within(wsRow).getByText("$2,400.00")).toBeInTheDocument();
    expect(within(wsRow).getByText("$0.00")).toBeInTheDocument();

    const netRow = screen.getByTestId("comparison-row-annual_net_price");
    expect(within(netRow).getByText("$7,200.00")).toBeInTheDocument();
    expect(within(netRow).getByText("Incomplete")).toBeInTheDocument();

    const fourYearRow = screen.getByTestId(
      "comparison-row-four_year_conservative",
    );
    expect(within(fourYearRow).getByText("$88,712.79")).toBeInTheDocument();

    expect(screen.getByTestId("comparison-row-housing")).toHaveTextContent(
      "Unknown",
    );
  });

  it("S2.3: source controls reveal fictional and official citations", async () => {
    const user = userEvent.setup();
    renderApp("/sample");

    expect(screen.getByText(/Synthetic demo/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /Cost of Attendance — Housing and Food/i,
      }),
    );

    const official = screen.getByTestId(
      "source-detail-src-loyola-housing-policy",
    );
    expect(within(official).getByText("www.loyola.edu")).toBeInTheDocument();
    expect(
      within(official).getByText("Official school policy"),
    ).toBeInTheDocument();
    expect(within(official).getByText("2026-03-12")).toBeInTheDocument();
    expect(
      within(official).getByText(
        /on-campus housing and food as a required budget/i,
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /UC San Diego Financial Aid Award Letter \(synthetic\)/i,
      }),
    );
    const fiction = screen.getByTestId("source-detail-src-ucsd-award");
    expect(
      within(fiction).getByText("sample.aidlens.local"),
    ).toBeInTheDocument();
    expect(
      within(fiction).getByText(
        /fictional award letter is not issued by UC San Diego/i,
      ),
    ).toBeInTheDocument();
  });

  it("S2.4: Conservative/Optimistic radios recalculate four-year totals", async () => {
    const user = userEvent.setup();
    renderApp("/sample");

    const conservative = screen.getByRole("radio", { name: "Conservative" });
    const optimistic = screen.getByRole("radio", { name: "Optimistic" });
    expect(conservative).toBeChecked();

    const consTotal = formatUsd(
      calculateComparison(buildSampleComparisonInput("conservative")).offers[0]
        .fourYear.totalNetPriceCents,
    );
    const optTotal = formatUsd(
      calculateComparison(buildSampleComparisonInput("optimistic")).offers[0]
        .fourYear.totalNetPriceCents,
    );
    expect(consTotal).not.toBe(optTotal);

    expect(
      within(
        screen.getByTestId("comparison-row-four_year_conservative"),
      ).getByText(consTotal),
    ).toBeInTheDocument();

    await user.click(optimistic);
    expect(optimistic).toBeChecked();
    expect(
      within(
        screen.getByTestId("comparison-row-four_year_optimistic"),
      ).getByText(optTotal),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Optimistic four-year total" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/3% annual cost growth/i)).toBeInTheDocument();
  });

  it("S2.5: clarification story is read-only with no send/edit controls", () => {
    renderApp("/sample");

    expect(
      screen.getByRole("heading", { name: /Clarification story/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("reply-proposal-question_open"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("reply-proposal-reply_received"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reply-proposal-confirmed")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /Approve and send/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Confirm update/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
