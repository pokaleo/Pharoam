import { createRecordFile, printRecordFile } from "@pharoam/core";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderUi } from "../__fixtures__/render-ui.tsx";
import { RecordFileView } from "./record-file-view.tsx";

describe("RecordFileView (MVP S4.2)", () => {
  it("shows a record exactly as the file it will be stored as, as text that never runs", async () => {
    const file = createRecordFile(
      { schema: "evidence/1", title: "<img src=x onerror=alert(1)>" },
      "**Bold** stays as written.\n",
    );
    const { container } = renderUi(<RecordFileView file={file} />);

    const region = await screen.findByRole("region", { name: "The file as it will be stored" });
    expect(region.textContent).toBe(printRecordFile(file));
    expect(container.querySelector("img, strong")).toBeNull();
  });

  it("is named after its record too, where several are shown together", async () => {
    const file = createRecordFile({ schema: "evidence/1" }, "");
    const title = "Payments API";
    renderUi(
      <>
        <h2 id="record">{title}</h2>
        <RecordFileView file={file} namedBy="record" />
      </>,
    );
    await screen.findByRole("region", { name: "The file as it will be stored Payments API" });
  });
});
