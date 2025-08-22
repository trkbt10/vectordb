/**
 * @file IndexStrategyModal: choose index strategy
 */
import React from "react";
import SelectInput from "ink-select-input";
import { Dialog } from "../Dialog";

/**
 * IndexStrategyModal: インデックス方式(探索戦略)を選択するためのモーダルコンポーネント。
 * 選択肢の提示と結果の通知を担い、実際の適用は呼び出し側に委ねる。
 */
export function IndexStrategyModal({
  open,
  onSelect,
  onCancel,
}: {
  open: boolean;
  onSelect: (strategy: string) => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <Dialog open={true} title="Index Strategy" width={60}>
      <SelectInput
        isFocused={true}
        items={[
          { label: "Bruteforce (high accuracy)", value: "bruteforce" },
          { label: "HNSW (fast ANN)", value: "hnsw" },
          { label: "IVF (coarse quantization)", value: "ivf" },
          { label: "Cancel", value: "cancel" },
        ]}
        onSelect={(i: { value: string }) => {
          if (i.value === "cancel") {
            return onCancel();
          }
          onSelect(i.value);
        }}
      />
    </Dialog>
  );
}
