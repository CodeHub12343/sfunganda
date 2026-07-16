"use client";

import { useMemo, useState } from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal } from "@/components/ui/Reveal";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/Field";
import { volunteer, brand } from "@/data/content";
import type { VolunteerTask } from "@/data/content";
import { media } from "@/styles/theme";

const Grid = styled.div`
  display: grid;
  gap: 3rem;
  align-items: start;
  grid-template-columns: 1fr;
  ${media.lg} {
    grid-template-columns: 0.85fr 1.15fr;
  }
`;

const Intro = styled.div`
  h2 {
    font-size: ${({ theme }) => theme.type.h2};
    margin: 1rem 0 1.25rem;
  }
  p {
    color: ${({ theme }) => theme.colors.inkSoft};
    max-width: 46ch;
  }
`;

const Panel = styled.form`
  padding: 1.5rem;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.glass};
  ${media.sm} {
    padding: 2rem;
  }
  ${media.md} {
    padding: 2.5rem;
  }
`;

const TaskLabel = styled.p`
  font-size: 0.9rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  color: ${({ theme }) => theme.colors.inkSoft};
  margin-bottom: 0.85rem;
`;

const Tasks = styled.div`
  display: grid;
  gap: 0.7rem;
  grid-template-columns: 1fr;
  ${media.sm} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const TaskCard = styled.button<{ $active: boolean }>`
  display: flex;
  gap: 0.75rem;
  text-align: left;
  padding: 0.9rem 1rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.warmCream : theme.colors.bgSoft};
  border: 1.5px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.sunriseOrange : theme.colors.border};
  transition: all 0.2s ${({ theme }) => theme.ease.out};
  cursor: pointer;
  &:hover {
    border-color: ${({ theme }) => theme.colors.sunriseOrange};
  }
  .icon {
    font-size: 1.4rem;
    line-height: 1;
  }
  .body strong {
    display: block;
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: 0.95rem;
  }
  .body span {
    color: ${({ theme }) => theme.colors.inkMuted};
    font-size: 0.82rem;
  }
`;

const Rows = styled.div`
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
`;

const TwoCol = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  ${media.sm} {
    grid-template-columns: 1fr 1fr;
  }
`;

const AddressBlock = styled(motion.div)`
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgSoft};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow: hidden;
  h3 {
    font-family: ${({ theme }) => theme.font.body};
    font-size: 0.95rem;
    font-weight: ${({ theme }) => theme.weight.semibold};
    color: ${({ theme }) => theme.colors.trustBlue};
  }
`;

const ConsentRow = styled.div`
  margin-top: 1.25rem;
`;

const Submit = styled.div`
  margin-top: 1.25rem;
`;

// Submit needs a real <button> (the shared Button is anchor-based), so we
// reproduce the primary variant look here.
const SubmitButton = styled(motion.button)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6em;
  width: 100%;
  min-height: 52px;
  padding: 1.05rem 1.9rem;
  font-family: ${({ theme }) => theme.font.body};
  font-weight: ${({ theme }) => theme.weight.semibold};
  font-size: ${({ theme }) => theme.type.small};
  color: #fff;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.gradients.sunrise};
  box-shadow: ${({ theme }) => theme.shadow.glow};
  cursor: pointer;
  transition: box-shadow 0.3s ${({ theme }) => theme.ease.out};
  &:hover {
    box-shadow: 0 18px 48px rgba(242, 140, 40, 0.45);
  }
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const Reassure = styled.p`
  margin-top: 1rem;
  text-align: center;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.inkMuted};
`;

const FormError = styled.p`
  margin-top: 1rem;
  text-align: center;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.attention};
`;

// --- Success state ---------------------------------------------------------
const Success = styled(motion.div)`
  text-align: center;
  padding: 2.5rem 1.5rem;
  h2 {
    font-size: ${({ theme }) => theme.type.h3};
    color: ${({ theme }) => theme.colors.trustBlue};
    margin-bottom: 0.75rem;
  }
  p {
    color: ${({ theme }) => theme.colors.inkSoft};
    max-width: 40ch;
    margin: 0 auto 1.5rem;
  }
`;

const ShareLabel = styled.span`
  display: block;
  font-size: 0.8rem;
  font-weight: ${({ theme }) => theme.weight.semibold};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.inkMuted};
  margin-bottom: 0.75rem;
`;

const ShareRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  justify-content: center;
  a,
  button {
    padding: 0.65rem 1.1rem;
    border-radius: ${({ theme }) => theme.radius.pill};
    font-size: 0.85rem;
    font-weight: ${({ theme }) => theme.weight.semibold};
    color: ${({ theme }) => theme.colors.trustBlue};
    background: ${({ theme }) => theme.colors.bgSoft};
    border: 1px solid ${({ theme }) => theme.colors.border};
    cursor: pointer;
    transition: all 0.2s ${({ theme }) => theme.ease.out};
    &:hover {
      border-color: ${({ theme }) => theme.colors.sunriseOrange};
    }
  }
`;

type Errors = Partial<
  Record<
    "fullName" | "email" | "phone" | "country" | "cityRegion" | "tasks" | "consent" | "address",
    string
  >
>;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sfuganda.com";
const SHARE_TEXT = `${brand.name} — ${brand.rally} Help vulnerable children in Uganda.`;

export function Volunteer() {
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [cityRegion, setCityRegion] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  // address
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  // honeypot — bots fill this, humans never see it
  const [website, setWebsite] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const needsAddress = useMemo(() => tasks.includes("flyer-distribution"), [tasks]);
  const needsPhone = useMemo(() => tasks.includes("text-marketing"), [tasks]);

  function toggleTask(id: VolunteerTask) {
    setTasks((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!fullName.trim()) e.fullName = "Please tell us your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email.";
    if (!country.trim()) e.country = "Where are you based?";
    if (!cityRegion.trim()) e.cityRegion = "Your city or region helps us coordinate.";
    if (tasks.length === 0) e.tasks = "Pick at least one way to help.";
    if (needsPhone && !phone.trim())
      e.phone = "A phone number is needed for text outreach.";
    if (needsAddress && (!line1.trim() || !city.trim() || !postalCode.trim()))
      e.address = "We need your mailing address to post flyers.";
    if (!consent) e.consent = "Please agree so we can contact you.";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setStatus("submitting");
    try {
      const res = await fetch("/api/volunteer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone: phone || undefined,
          country,
          cityRegion,
          tasks,
          address: needsAddress
            ? { line1, line2: line2 || undefined, city, stateProvince, postalCode, country }
            : undefined,
          note: note || undefined,
          consent,
          website, // honeypot
          source: "website",
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(SITE_URL);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <Section id="volunteer" $tone="soft">
      <Container $wide>
        <Grid>
          <Intro>
            <Reveal>
              <SectionLabel>{volunteer.eyebrow}</SectionLabel>
              <h2>{volunteer.title}</h2>
              <p>{volunteer.lede}</p>
            </Reveal>
          </Intro>

          <Reveal delay={0.1}>
            <AnimatePresence mode="wait">
              {status === "success" ? (
                <Success
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2>{volunteer.successTitle}</h2>
                  <p>{volunteer.successBody}</p>
                  <ShareLabel>{volunteer.successShareLabel}</ShareLabel>
                  <ShareRow>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Facebook
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SITE_URL)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      X / Twitter
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${SITE_URL}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                    <button type="button" onClick={copyLink}>
                      Copy link
                    </button>
                  </ShareRow>
                </Success>
              ) : (
                <Panel key="form" onSubmit={handleSubmit} noValidate>
                  <TaskLabel>{volunteer.tasksLabel}</TaskLabel>
                  <Tasks>
                    {volunteer.tasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        type="button"
                        $active={tasks.includes(t.id)}
                        aria-pressed={tasks.includes(t.id)}
                        onClick={() => toggleTask(t.id)}
                      >
                        <span className="icon" aria-hidden>
                          {t.icon}
                        </span>
                        <span className="body">
                          <strong>{t.title}</strong>
                          <span>{t.blurb}</span>
                        </span>
                      </TaskCard>
                    ))}
                  </Tasks>
                  {errors.tasks && <FormError>{errors.tasks}</FormError>}

                  <Rows>
                    <TwoCol>
                      <Field label="Full name" required error={errors.fullName}>
                        {(p) => (
                          <Input
                            {...p}
                            $invalid={Boolean(errors.fullName)}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            autoComplete="name"
                          />
                        )}
                      </Field>
                      <Field label="Email" required error={errors.email}>
                        {(p) => (
                          <Input
                            {...p}
                            type="email"
                            $invalid={Boolean(errors.email)}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                          />
                        )}
                      </Field>
                    </TwoCol>

                    <TwoCol>
                      <Field label="Country" required error={errors.country}>
                        {(p) => (
                          <Input
                            {...p}
                            $invalid={Boolean(errors.country)}
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            autoComplete="country-name"
                          />
                        )}
                      </Field>
                      <Field label="City / Region" required error={errors.cityRegion}>
                        {(p) => (
                          <Input
                            {...p}
                            $invalid={Boolean(errors.cityRegion)}
                            value={cityRegion}
                            onChange={(e) => setCityRegion(e.target.value)}
                          />
                        )}
                      </Field>
                    </TwoCol>

                    <Field
                      label="Phone"
                      required={needsPhone}
                      error={errors.phone}
                    >
                      {(p) => (
                        <Input
                          {...p}
                          type="tel"
                          $invalid={Boolean(errors.phone)}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          autoComplete="tel"
                          placeholder={needsPhone ? "" : "Optional"}
                        />
                      )}
                    </Field>

                    <AnimatePresence>
                      {needsAddress && (
                        <AddressBlock
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <h3>Where should we mail your flyers?</h3>
                          {errors.address && <FormError>{errors.address}</FormError>}
                          <Field label="Address line 1" required>
                            {(p) => (
                              <Input
                                {...p}
                                value={line1}
                                onChange={(e) => setLine1(e.target.value)}
                                autoComplete="address-line1"
                              />
                            )}
                          </Field>
                          <Field label="Address line 2">
                            {(p) => (
                              <Input
                                {...p}
                                value={line2}
                                onChange={(e) => setLine2(e.target.value)}
                                autoComplete="address-line2"
                              />
                            )}
                          </Field>
                          <TwoCol>
                            <Field label="City" required>
                              {(p) => (
                                <Input
                                  {...p}
                                  value={city}
                                  onChange={(e) => setCity(e.target.value)}
                                  autoComplete="address-level2"
                                />
                              )}
                            </Field>
                            <Field label="State / Province">
                              {(p) => (
                                <Input
                                  {...p}
                                  value={stateProvince}
                                  onChange={(e) => setStateProvince(e.target.value)}
                                  autoComplete="address-level1"
                                />
                              )}
                            </Field>
                          </TwoCol>
                          <Field label="Postal code" required>
                            {(p) => (
                              <Input
                                {...p}
                                value={postalCode}
                                onChange={(e) => setPostalCode(e.target.value)}
                                autoComplete="postal-code"
                              />
                            )}
                          </Field>
                        </AddressBlock>
                      )}
                    </AnimatePresence>

                    <Field label="Anything else? (optional)">
                      {(p) => (
                        <Textarea
                          {...p}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Tell us about your skills or how else you'd like to help."
                        />
                      )}
                    </Field>
                  </Rows>

                  {/* Honeypot: visually hidden, off-screen; bots fill it. */}
                  <div aria-hidden style={{ position: "absolute", left: "-9999px" }}>
                    <label>
                      Website
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </label>
                  </div>

                  <ConsentRow>
                    <Checkbox checked={consent} onChange={setConsent}>
                      {volunteer.consentLabel}
                    </Checkbox>
                    {errors.consent && <FormError>{errors.consent}</FormError>}
                  </ConsentRow>

                  <Submit>
                    <SubmitButton
                      type="submit"
                      disabled={status === "submitting"}
                      whileHover={status === "submitting" ? undefined : { y: -3 }}
                      whileTap={status === "submitting" ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    >
                      {status === "submitting"
                        ? volunteer.submittingLabel
                        : volunteer.submitLabel}{" "}
                      →
                    </SubmitButton>
                  </Submit>

                  {status === "error" && <FormError>{volunteer.errorMessage}</FormError>}
                  <Reassure>{volunteer.reassure}</Reassure>
                </Panel>
              )}
            </AnimatePresence>
          </Reveal>
        </Grid>
      </Container>
    </Section>
  );
}
