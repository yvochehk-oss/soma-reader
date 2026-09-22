export function validateCliOptions(args, { valueFlags, booleanFlags }) {
  const values = new Set(valueFlags);
  const booleans = new Set(booleanFlags);
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!flag.startsWith("--")) throw new Error(`Unexpected positional argument: ${flag}`);
    if (seen.has(flag)) throw new Error(`Option ${flag} may be provided only once.`);
    seen.add(flag);
    if (booleans.has(flag)) continue;
    if (!values.has(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Option ${flag} requires a value.`);
    index += 1;
  }
}
