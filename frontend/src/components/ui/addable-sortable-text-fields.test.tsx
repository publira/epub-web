// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { RawIntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppIntl } from "#lib/i18n";

import { AddableSortableTextFields } from "./addable-sortable-text-fields";

const EnglishIntl = ({ children }: { children: ReactNode }) => (
  <RawIntlProvider value={getAppIntl("en")}>{children}</RawIntlProvider>
);

describe("sortable text fields", () => {
  afterEach(() => {
    cleanup();
  });

  it("forwards add, edit, and remove actions with the correct item id", () => {
    const onAdd = vi.fn<() => void>();
    const onChange = vi.fn<(id: string, value: string) => void>();
    const onRemove = vi.fn<(id: string) => void>();

    render(
      <AddableSortableTextFields
        addButtonLabel="Add"
        items={[
          { id: "author-a", value: "Alice" },
          { id: "author-b", value: "Bob" },
        ]}
        label="Authors"
        onAdd={onAdd}
        onChange={onChange}
        onRemove={onRemove}
        onReorder={vi.fn<(items: { id: string; value: string }[]) => void>()}
      />,
      { wrapper: EnglishIntl }
    );

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByDisplayValue("Alice"), {
      target: { value: "Alice Cooper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("author-a", "Alice Cooper");
    expect(onRemove).toHaveBeenCalledWith("author-b");
  });

  it("names an empty row by its position", () => {
    render(
      <AddableSortableTextFields
        addButtonLabel="Add"
        items={[
          { id: "author-a", value: "Alice" },
          { id: "author-b", value: "" },
        ]}
        label="Authors"
        onAdd={vi.fn<() => void>()}
        onChange={vi.fn<(id: string, value: string) => void>()}
        onRemove={vi.fn<(id: string) => void>()}
        onReorder={vi.fn<(items: { id: string; value: string }[]) => void>()}
      />,
      { wrapper: EnglishIntl }
    );

    expect(screen.getByRole("button", { name: "Remove Item 2" })).toBeTruthy();
  });

  it("disables structural actions while a field group is disabled", () => {
    render(
      <AddableSortableTextFields
        addButtonLabel="Add"
        disabled
        items={[{ id: "author-a", value: "Alice" }]}
        label="Authors"
        onAdd={vi.fn<() => void>()}
        onChange={vi.fn<(id: string, value: string) => void>()}
        onRemove={vi.fn<(id: string) => void>()}
        onReorder={vi.fn<(items: { id: string; value: string }[]) => void>()}
      />,
      { wrapper: EnglishIntl }
    );

    expect(
      screen.getByRole("button", { name: "Add" }).hasAttribute("disabled")
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Remove Alice" })
        .hasAttribute("disabled")
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Change the order of Alice" })
        .hasAttribute("disabled")
    ).toBeTruthy();
  });
});
