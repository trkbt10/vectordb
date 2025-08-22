/**
 * @file RowActionModal: choose action for a row (edit/delete)
 */
import React from "react";
import { Text } from "ink";
import SelectInput from "ink-select-input";
import { Dialog } from "../Dialog";

/**
 * RowActionModal: 指定行に対する操作(メタ更新/削除/キャンセル)を選択するモーダルコンポーネント。
 * 行番号の表示と選択に応じたコールバックの発火のみを担う。
 */
export function RowActionModal({
  open,
  rowId,
  onEdit,
  onDelete,
  onCancel,
}: {
  open: boolean;
  rowId: number | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Dialog open={true} title="Row Actions" width={60}>
      <Text>Row {rowId ?? "-"} — Choose action</Text>
      <SelectInput
        isFocused={true}
        items={[
          { label: "Update Meta (JSON)", value: "edit" },
          { label: "Delete", value: "delete" },
          { label: "Cancel", value: "cancel" },
        ]}
        onSelect={(i: { value: string }) => {
          if (i.value === "cancel") return onCancel();
          if (i.value === "delete") return onDelete();
          if (i.value === "edit") return onEdit();
        }}
      />
    </Dialog>
  );
}
