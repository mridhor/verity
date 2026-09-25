import next from "eslint-config-next";

const config = [
  ...next,
  {
    rules: {
      // Rule 5: identity comes from verified JWT claims only, never from request headers.
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='get'][arguments.0.value=/^x-(tenant|user|role)/i]",
          message: "Do not read identity from request headers; use getPrincipal().",
        },
      ],
    },
  },
];

export default config;
