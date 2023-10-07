export function formatPrompt(
  prompt: string,
  inputVariables: Array<any[] | string>
): string {
  let index = 0 // Initialize an index for inputVariables

  // Use a regular expression to find all placeholders in the format {something}
  const regex = /\{([^\}]+)\}/g
  return prompt.replace(regex, (match, p1) => {
    let replacement = inputVariables[index]
    if (Array.isArray(replacement)) {
      replacement = replacement.join(', ')
    }
    index++ // Move to the next variable for the next match
    return replacement as string
  })
}
