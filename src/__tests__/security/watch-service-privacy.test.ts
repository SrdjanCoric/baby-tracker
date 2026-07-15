import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("Watch service privacy", () => {
  it("does not pass received message, queue, or reply payloads to logs", () => {
    const source = readFileSync(
      new URL("../../services/watch-service.ts", import.meta.url),
      "utf8"
    );

    const sourceFile = ts.createSourceFile(
      "watch-service.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const sensitiveIdentifiers = new Set([
      "message",
      "payload",
      "reply",
      "response",
      "userInfoArray",
      "queuedActions",
    ]);
    const unsafeCalls: string[] = [];

    const containsSensitiveIdentifier = (node: ts.Node): boolean => {
      if (ts.isIdentifier(node) && sensitiveIdentifiers.has(node.text)) return true;
      return node.getChildren(sourceFile).some(containsSensitiveIdentifier);
    };

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "console" &&
        node.arguments.some(containsSensitiveIdentifier)
      ) {
        unsafeCalls.push(node.getText(sourceFile));
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    expect(unsafeCalls).toEqual([]);
  });
});
