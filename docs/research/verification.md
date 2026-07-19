# Verification research — July 2026

Findings behind the identity-verification design. Read this before changing anything about
Didit, NBI copy, or who pays for verification.

## The decisions this produced

1. **Didit steps enabled:** ID Verification, Passive Liveness, Face Match 1:1, Device & IP
   Analysis — the whole Full KYC bundle, free for 500/month. NFC Verification ($0.15) as an
   optional upgrade for Philippine ePassport holders only; most workers don't hold one.
2. **AML screening deliberately skipped.** A job platform is not a covered person under
   RA 9160. Enabling it invites a regulator to ask which regulation we think we're complying
   with, and adds false positives.
3. **We never link to `verification.nbi-clearance.io`.** See below.
4. **Never store the PhilSys PSN.** Card-level PCN only.
5. **Didit retention must be set explicitly** — it defaults to indefinite.
6. **Don't call it "KYC" in user-facing copy.** It is identity verification. KYC is a
   regulated term for regulated entities.

## verification.nbi-clearance.io is not official

Verified directly, July 2026:

| Signal | Finding |
|---|---|
| Domain | `.io` — Philippine government is `.gov.ph` only |
| Registrant | Domains By Proxy, LLC (Arizona) — privacy-shielded |
| Registrar / host | GoDaddy / Cloudflare |
| Backend | `alpha-ws.nbi-clearance.io` — its own private Laravel API |
| Contact with NBI | **None.** It never touches any `nbi.gov.ph` host |
| Operator | No About page, no contact, no name |

Routing a worker's NBI details there would hand sensitive personal information to an
unidentified party. There is also **no confirmed official NBI verification portal or public
API**, and what the QR code on a post-2019 clearance resolves to could not be established
from any sourced material — the open web on this subject is dominated by SEO spam.

**Open question worth settling:** scan a real post-2019 clearance and record what the QR
actually hits. Everything published about it is unsourced.

## What an NBI clearance proves

That on the issue date, a search of NBI's own database against the presented name and
biometrics returned no derogatory record.

It does **not** cover foreign convictions, PNP blotter entries, barangay records, civil,
labour or credit matters, or complaints not yet filed with NBI. It says nothing about
whether the presenter is the person named. Valid one year.

In January 2025, four NBI ICT Division staff and seven fixers were arrested for selling
fast-tracked clearances. The failure mode is not only forged paper — it is genuine documents
issued through corrupted process. No authenticity check catches that.

## What Philippine agencies actually verify

Near-universal across OnlineJobs.ph, MyOutDesk, Virtual Coworker, Remote Staff, Athena,
Outsourced.ph:

1. Identity — government ID, increasingly with liveness, because *proxy interviewees* are
   the threat everyone names
2. At least one live human interview
3. Work-capability proof — skills/English test plus hardware, internet speed and quiet-room
   checks

NBI clearance is **not** universal. No surveyed agency names it on its screening page. The
split is employment model, not quality: EOR/BPO-employed staff go through statutory PH
onboarding including NBI; contractor placements stop at identity + interview + test.

"FBI-grade background check" is the market's most repeated claim and is undefined on every
site using it. An FBI Identity History Summary is fingerprint-keyed to US arrest records —
for a Filipino who never lived in the US it returns nothing.

**The gap nobody covers:** no agency verifies that the person who passed the interview is
the person doing the work.

## Philippine identity documents, ranked for automated verification

**Tier 1 — the correct rails.** Philippine ePassport (ICAO 9303 MRZ + NFC chip,
cryptographically self-verifying offline). PhilSys National ID with **eVerify**
(everify.gov.ph, PSA + DICT, June 2024, official face match against the registry; DICT
issues API keys; private-sector onboarding via fpsucd@psa.gov.ph).

**Tier 2** — PRC e-PIC (licensed professionals, free public registry at
verification.prc.gov.ph); LTO driver's licence (good OCR/face-match target, no relying-party
API).

**Tier 3 — OCR + face match only** — UMID, SSS, PhilHealth, Pag-IBIG.

**Tier 4 — not identity evidence** — legacy TIN ID, barangay clearance, voter's
certification.

Most faked, roughly: legacy TIN ID > PWD ID > driver's licence > postal ID > barangay
clearance > SSS/UMID > PhilID (rising). Fake IDs sell for ₱150–₱380 and are openly listed on
Lazada and Shopee.

**PSN vs PCN.** The PSN is permanent, person-level and classified sensitive personal
information under RA 11055 — unauthorised collection or storage carries 3–6 years
imprisonment and fines to ₱4M. The PCN is card-level and designed for public-facing use.
Store the PCN, never the PSN.

## Didit pricing, July 2026

Free forever, 500/month: ID Verification, Passive Liveness, Face Match 1:1, Device & IP
Analysis. Beyond that, $0.33 for the bundle.

| Step | Price |
|---|---|
| NFC Verification | $0.15 |
| AML Screening | $0.20 |
| Proof of Address | $0.20 |
| Questionnaire | $0.10 |
| PH Database Validation (`phl_residential`) | $0.16 |

Philippine support confirmed: PhilID, UMID, ePassport with NFC read, LTO licence, legacy
voter's ID. Didit is a Spanish company, SOC 2 Type I, ISO 27001, GDPR, iBeta Level 1.

`phl_residential` claims >80% adult coverage — that is Didit's own marketing. Test it against
the free tier before repeating it anywhere.

## What verification actually buys an employer

It proves a real, unique human matching a genuine document completed a check at a point in
time. That raises the cost of fake accounts and makes account-renting harder — but only if
re-verified, not verified once.

**The counter-example a skeptical buyer already knows.** KnowBe4, July 2024, hired a North
Korean operative as a principal engineer. The background check came back clear because the
identity was a real stolen one. Four video interviews matched the submitted photo because the
photo was AI-enhanced. He loaded malware on day one; EDR caught it and access was cut within
25 minutes. **Pre-hire identity verification failed; post-hire endpoint monitoring worked.**

Microsoft has documented FaceSwap AI inserting operative faces into stolen ID documents, one
photo reused across personas. NIST SP 800-63-4 concedes its face-recognition benchmarks do
not cover deepfake or injection attacks.

Verification cannot address: overemployment, subcontracting, insider threat after onboarding,
or skill and credential fraud. **It confirms identity, never competence.**

**The Philippines does not appear** in any government or threat-intel reporting as a claimed
nationality or facilitator hub for the DPRK scheme. Do not borrow that fear for marketing.

**Account renting is the relevant threat.** Comparitech documented 280+ Upwork accounts for
sale, average ask ~$1,330, renting for several hundred a month, operated via VPN and
TeamViewer. Their conclusion: one-time ID verification makes it *easier* to sell a verified
account.

**Rate data in this category is weak.** Gartner's "1 in 4 candidate profiles fake by 2028" is
a forecast with no published derivation; the underlying survey found 6% admitted interview
fraud. The only non-vendor hard data is FBI/DOJ casework.

**Over-verification harms legitimate workers.** NIST demographic testing shows Black women
misidentified 2–40× more often than white men. Workers in the Global South fail
disproportionately on document, name and address mismatches. False rejections land on real
people.

## Legal

**Data Privacy Act (RA 10173).** Government ID numbers are sensitive personal information.
Biometrics are not expressly listed — a real gap; treat them as SPI anyway. The only workable
lawful basis for SPI is **consent, given before processing** — "necessary for a contract" is
a Sec. 12 basis and does not apply to Sec. 13 SPI. This is precisely why verification must
stay optional: it makes consent genuinely freely given.

Store the verdict, not the document. Retaining raw ID images after a pass/fail result is the
classic violation. A DPO and DPS registration become mandatory once SPI of ≥1,000 individuals
is processed (NPC Circular 2022-04) — we cross that threshold quickly. Breach notification is
72 hours. Didit is a personal information processor, so we need an outsourcing agreement, not
a data-sharing agreement. Cross-border transfer to Spain needs no permit but does need
contractual protection; NPC Advisory 2024-01 model clauses are the cheapest discharge.

Penalties for unauthorised SPI processing: 3–6 years and ₱500k–₱4M. **Responsible officers
are personally liable under Sec. 34.**

### Charging talent — the live exposure

Labor Code **Art. 13(b)** defines recruitment and placement broadly and **expressly includes
referrals**. If shortlisted.ph is a private employment agency, **DOLE D.O. 141-14 Sec. 35 is
absolute**: *"No fees whatsoever shall be collected neither deducted from the salaries or
wages of the workers."* No exception for at-cost, pass-through, or optional. The same order
permits charging the **employer**.

Factors that turn an optional fee into a placement fee:

1. Paying is required in practice to be shortlisted
2. **Verified profiles rank higher, making optionality nominal**
3. Any margin
4. Collected before employment materialises
5. Copy tying payment to outcomes ("get hired faster")

The current product does **(2)** — verification improves ranking — while charging for it.
Didit's free tier covers 500/month, so making verification free costs nothing and removes the
exposure while keeping the ranking signal. That decision sits with the founder; the toggle is
`PRODUCTS.verification` in `src/lib/payments.ts`.

DMW/POEA almost certainly does not apply — their jurisdiction attaches to deployment abroad,
and a worker who stays in the Philippines is not an OFW. No issuance confirming this for
remote work was found.

### Needs a Philippine lawyer, not an engineer

1. Is auto-shortlisting "recruitment and placement" under Art. 13(b)? This decides whether
   the fee ban and PEA licensing apply at all. Highest-stakes question here.
2. Is a PH-based remote worker for a foreign employer inside or outside the DMW regime?
3. NPC's actual position on retaining ID images post-verification.

## Sources

Research conducted 2026-07-19. Primary: didit.me/pricing, docs.didit.me,
didit.me/solutions/countries/philippines, philsys.gov.ph, dole.gov.ph D.O. 141-14,
onlinejobs.ph/idproof, athena.com/faqs, outsourced.ph, blog.knowbe4.com,
cloud.google.com/blog/topics/threat-intelligence, justice.gov press releases,
comparitech.com, privacy.gov.ph, respicio.ph. RDAP lookup and HTTP probe of
nbi-clearance.io performed directly.
