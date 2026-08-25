// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddableSortableTextFields } from "./addable-sortable-text-fields";

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
        addButtonLabel="追加"
        items={[
          { id: "author-a", value: "Alice" },
          { id: "author-b", value: "Bob" },
        ]}
        label="著者"
        onAdd={onAdd}
        onChange={onChange}
        onRemove={onRemove}
        onReorder={vi.fn<(items: { id: string; value: string }[]) => void>()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    fireEvent.change(screen.getByDisplayValue("Alice"), {
      target: { value: "Alice Cooper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Bob を削除" }));

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("author-a", "Alice Cooper");
    expect(onRemove).toHaveBeenCalledWith("author-b");
  });

  it("disables structural actions while a field group is disabled", () => {
    render(
      <AddableSortableTextFields
        addButtonLabel="追加"
        disabled
        items={[{ id: "author-a", value: "Alice" }]}
        label="著者"
        onAdd={vi.fn<() => void>()}
        onChange={vi.fn<(id: string, value: string) => void>()}
        onRemove={vi.fn<(id: string) => void>()}
        onReorder={vi.fn<(items: { id: string; value: string }[]) => void>()}
      />
    );

    expect(
      screen.getByRole("button", { name: "追加" }).hasAttribute("disabled")
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Alice を削除" })
        .hasAttribute("disabled")
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Alice の並び順を変更" })
        .hasAttribute("disabled")
    ).toBeTruthy();
  });
});
