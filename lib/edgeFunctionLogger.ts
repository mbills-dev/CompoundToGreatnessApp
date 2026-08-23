let edgeCallCounter = 0;

export function logEdgeFunctionCall(functionName: string): void {
  edgeCallCounter++;
  console.log(
    `[EDGE CALL #${edgeCallCounter}] ${functionName} at ${new Date().toISOString()}`,
  );
}
