import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { SITE_URL } from "@/lib/site";

/**
 * Shared shell for every transactional email.
 *
 * Styles are inline objects, not classes: Gmail strips <style> blocks and
 * Outlook ignores most of what survives. Anything that must render has to
 * ride on the element itself.
 */

const palette = {
  paper: "#fafcfd",
  ink: "#17201b",
  inkSoft: "#51605a",
  inkFaint: "#67766e",
  line: "#e3e9e5",
  brand: "#306644",
  brandSoft: "#eaf2ed",
  ember: "#a4491a",
  white: "#ffffff",
};

const sans =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
// Georgia is on effectively every mail client, so the display face survives
// where a webfont would silently fall back.
const display = 'Georgia, "Times New Roman", serif';

export const styles = {
  palette,
  sans,
  display,
  heading: {
    margin: "0 0 14px",
    fontFamily: display,
    fontSize: "24px",
    lineHeight: "1.25",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: palette.ink,
  },
  text: {
    margin: "0 0 14px",
    fontFamily: sans,
    fontSize: "15px",
    lineHeight: "1.6",
    color: palette.inkSoft,
  },
  small: {
    margin: "0 0 8px",
    fontFamily: sans,
    fontSize: "13px",
    lineHeight: "1.55",
    color: palette.inkFaint,
  },
  // Anchor styled as a button: <Button> renders a table in some clients and
  // loses its padding in others.
  button: {
    display: "inline-block",
    padding: "12px 22px",
    borderRadius: "12px",
    backgroundColor: palette.brand,
    color: palette.white,
    fontFamily: sans,
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
  },
  card: {
    margin: "0 0 22px",
    padding: "18px 20px",
    borderRadius: "14px",
    border: `1px solid ${palette.line}`,
    backgroundColor: palette.paper,
  },
  label: {
    margin: "0 0 4px",
    fontFamily: sans,
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: palette.inkFaint,
  },
  value: {
    margin: 0,
    fontFamily: sans,
    fontSize: "15px",
    fontWeight: 600,
    color: palette.ink,
  },
  link: { color: palette.brand, textDecoration: "underline" },
};

export function Shell({
  preview,
  children,
  footnote,
}: {
  preview: string;
  children: React.ReactNode;
  footnote?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "32px 12px",
          backgroundColor: palette.paper,
          fontFamily: sans,
        }}
      >
        <Container style={{ maxWidth: "560px", margin: "0 auto" }}>
          <Section style={{ padding: "0 4px 18px" }}>
            <Link
              href={SITE_URL}
              style={{
                fontFamily: display,
                fontSize: "17px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: palette.ink,
                textDecoration: "none",
              }}
            >
              shortlisted<span style={{ color: palette.ember }}>.ph</span>
            </Link>
          </Section>

          <Section
            style={{
              padding: "30px 32px 26px",
              borderRadius: "18px",
              border: `1px solid ${palette.line}`,
              backgroundColor: palette.white,
            }}
          >
            {children}
          </Section>

          <Section style={{ padding: "20px 4px 0" }}>
            {footnote ? <Text style={styles.small}>{footnote}</Text> : null}
            <Hr style={{ margin: "14px 0", borderColor: palette.line }} />
            <Text style={{ ...styles.small, margin: 0 }}>
              shortlisted.ph — Filipino talent, shortlisted for you.{" "}
              <Link href={`${SITE_URL}/privacy`} style={styles.link}>
                Privacy
              </Link>{" "}
              ·{" "}
              <Link href={`${SITE_URL}/terms`} style={styles.link}>
                Terms
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
