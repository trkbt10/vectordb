export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow using && as a replacement for the ternary operator",
    },
    schema: [],
  },
  create(context) {
    return {
      LogicalExpression(node) {
        if (node.operator !== "&&") return;

        const parent = node.parent.type;
        // Using it in a value-returning position is disallowed (considered a ternary replacement)
        if (
          parent === "VariableDeclarator" || // const x = a && b
          parent === "AssignmentExpression" || // x = a && b
          parent === "ReturnStatement" || // return a && b
          parent === "ExpressionStatement" // a && b;
        ) {
          context.report({
            node,
            message: "Do not use && as a replacement for the ternary operator.",
          });
        }
      },
    };
  },
};
