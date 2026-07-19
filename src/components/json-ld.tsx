/**
 * Structured data for search and answer engines.
 *
 * `data` is always a developer-authored constant — never user input, never a
 * database read. The `<` escape is belt-and-braces against a future caller
 * passing a string containing `</script>`.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
