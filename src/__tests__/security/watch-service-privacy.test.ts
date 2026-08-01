import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("Watch credential retention", () => {
  it("drops the cached application context on sign-out and on session expiry", () => {
    const authContext = readFileSync(
      new URL("../../contexts/auth-context.tsx", import.meta.url),
      "utf8"
    );

    // The cache holds the session access token so a language change can
    // republish it. Left behind, the next caregiver on a shared device would
    // hand the Watch the previous account's still-valid credentials.
    expect(authContext).toContain('import { clearWatchContext } from "@/services/watch-service"');

    const clearCalls = authContext.match(/clearWatchContext\(\)/g) ?? [];
    const widgetClears = authContext.match(/await clearWidgetData\(\)/g) ?? [];
    expect(clearCalls.length).toBe(widgetClears.length);
    expect(clearCalls.length).toBeGreaterThanOrEqual(2);
  });
});

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
