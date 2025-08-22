/**
 * @file EditMetaModal: edit meta JSON for a row
 */
import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { Dialog } from "../Dialog";

/**
 * EditMetaModal: 単一行のメタデータ(JSON文字列)を編集・保存するモーダルコンポーネント。
 * 不正な入力検証は外部に委ね、ここではテキストの受け渡しと選択操作のみを扱う。
 */
export function EditMetaModal({
  open,
  initialMetaText,
  onSave,
  onCancel,
}: {
  open: boolean;
  initialMetaText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = React.useState<string>(initialMetaText);
  React.useEffect(() => setText(initialMetaText), [initialMetaText]);
  if (!open) return null;
  return (
    <Dialog open={true} title="Edit Meta" width={60}>
      <Text>Meta (JSON):</Text>
      <TextInput value={text} onChange={setText} />
      <Box marginTop={1}>
        <SelectInput
          isFocused={true}
          items={[{ label: "Save", value: "save" }, { label: "Cancel", value: "cancel" }]}
          onSelect={(i: { value: string }) => {
            if (i.value === "cancel") return onCancel();
            onSave(text);
          }}
        />
      </Box>
    </Dialog>
  );
}
