export default {
  meta: {
    type: "problem",
    docs: {
      description: "Ternary expressions must be single-line and within 120 characters",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      ConditionalExpression(node) {
        const text = sourceCode.getText(node);

        // No line breaks
        if (text.includes("\n")) {
          context.report({
            node,
            message: "Write ternary expressions on a single line (no line breaks).",
          });
        }

        // Limit to 120 characters total
        if (text.length > 120) {
          context.report({
            node,
            message: "Keep ternary expressions within 120 characters.",
          });
        }
      },
    };
  },
};
