// =============================================================================
// Sarah's Foundation Uganda — Content layer
// All editorial copy & data in one place so the team can update the site
// without touching component code. Copy reflects the real foundation: founded
// in 2016, ~30 children in care, run as a partnership between Leon (day-to-day
// operations in Uganda) and James Scott Bowser of Honest Need.
// =============================================================================

export const brand = {
  name: "Sarah's Foundation",
  fullName: "Sarah's Foundation Uganda",
  pillars: ["Providing Hope", "Creating Home", "Creating Lives"],
  mission:
    "Providing vulnerable children in Uganda with hope, love, protection, and the opportunity to build a better future.",
  tagline: "See Good. Do Good.",
  rally: "Together We Win. Together We Rise.",
};

// The partnership behind the foundation.
export const partners = {
  blurb:
    "Sarah's Foundation is led through a partnership between Leon, who oversees day-to-day operations in Uganda, and James Scott Bowser, owner of Honest Need.",
  people: [
    {
      name: "Leon",
      role: "Operations · Uganda",
      note: "Cares for the children on the ground, every single day.",
    },
    {
      name: "James Scott Bowser",
      role: "Owner, Honest Need",
      note: "Helps raise awareness, attract supporters, and fund the mission.",
    },
  ],
};

// Route-aware navigation. All targets are either in-page anchors on `/` or
// real routes — never dead `#` links (T6).
export const nav = [
  { label: "Our Story", href: "/#story" },
  { label: "What We Need", href: "/#impact" },
  { label: "Donate", href: "/#sponsor" },
  { label: "Volunteer", href: "/#volunteer" },
  { label: "Transparency", href: "/#transparency" },
  { label: "Stories", href: "/#stories" },
] as const;

export const hero = {
  eyebrow: "Providing Hope · Creating Home · Creating Lives",
  headline: ["Every child deserves", "hope, safety, and a", "place to call home."],
  subhead:
    "Sarah's Foundation Uganda has been a safe haven for vulnerable children since 2016. Today, in partnership with Honest Need, we provide food, education, healthcare, and love to more than 30 children — and we're building them a permanent home.",
  primaryCta: { label: "Donate Now", href: "/#sponsor" },
  secondaryCta: { label: "Read Their Story", href: "/#story" },
  floatingStats: [
    { value: 30, label: "Children cared for" },
    { value: 2016, label: "Caring since" },
    { value: 40, label: "Home for 40+ planned" },
  ],
};

export type Stat = {
  value: number;
  suffix?: string;
  label: string;
  detail: string;
};

export const impactStats: Stat[] = [
  {
    value: 30,
    suffix: "+",
    label: "Children cared for",
    detail: "with food, schooling, healthcare, and love every single day.",
  },
  {
    value: 2016,
    label: "Caring since",
    detail: "when one act of compassion became a safe haven for children.",
  },
  {
    value: 5,
    label: "Daily care programs",
    detail: "food, education, healthcare, counseling, and spiritual guidance.",
  },
  {
    value: 40,
    suffix: "+",
    label: "The home we're building",
    detail: "a permanent, self-sustaining home for the children to come.",
  },
];

export const story = {
  eyebrow: "Our Story",
  title: "It began in 2016 with one act of compassion.",
  lede: "What started as a small act of kindness has grown into a community of care for more than 30 children — and a partnership between Leon, James Scott Bowser, and Honest Need to give them a lasting future.",
  timeline: [
    {
      tag: "The Past",
      year: "2016",
      title: "A safe haven begins",
      body: "Founded to give vulnerable children hope, love, and protection after the loss of parents, poverty, hunger, and neglect.",
    },
    {
      tag: "The Present",
      year: "Today",
      title: "A partnership for the children",
      body: "Leon leads care in Uganda while James Scott Bowser and Honest Need raise support — together providing for 30+ children every day.",
    },
    {
      tag: "The Future",
      year: "Tomorrow",
      title: "A permanent, self-sustaining home",
      body: "Land and a forever-home for 40+ children, sustained by farming and small businesses that feed and fund the foundation.",
    },
  ],
};

export type AreaOfImpact = {
  id: string;
  title: string;
  blurb: string;
  detail: string;
  metric: string;
  accent: "gold" | "green" | "blue";
};

export const areas: AreaOfImpact[] = [
  {
    id: "child-welfare",
    title: "Care & Protection",
    blurb: "Food, healthcare, counseling, and a loving home for every child.",
    detail:
      "Daily meals, medical care, counseling, and spiritual guidance — so a child is safe and cared for first, and free to simply be a child.",
    metric: "30+ children in daily care",
    accent: "gold",
  },
  {
    id: "housing",
    title: "A Permanent Home",
    blurb: "Turning a rented shelter into a forever home.",
    detail:
      "We've identified land and housing that would give the children safety and stability for years to come. Our goal is to raise $15,000 to make it theirs.",
    metric: "$15,000 home & land goal",
    accent: "green",
  },
  {
    id: "education",
    title: "Education & Skills",
    blurb: "School fees, materials, and skills for a brighter future.",
    detail:
      "Tuition, books, and life skills through poultry, gardens, and small-business projects — carrying each child toward a successful, independent adulthood.",
    metric: "Schooling for every child",
    accent: "blue",
  },
];

export type Region = {
  id: string;
  name: string;
  headline: string;
  unit: string;
  blurb: string;
  // approximate position on the stylised map (% from left/top), clustered on Uganda
  x: number;
  y: number;
};

// Reframed from "regions" to the foundation's immediate, concrete goals in Uganda.
export const regions: Region[] = [
  {
    id: "care",
    name: "Daily Care",
    headline: "30+",
    unit: "children cared for today",
    blurb: "Food, healthcare, counseling, and a loving home — every single day.",
    x: 63,
    y: 50,
  },
  {
    id: "home",
    name: "A Permanent Home",
    headline: "$15,000",
    unit: "for land & a forever home",
    blurb: "A safe, stable place where the children can grow and flourish for years to come.",
    x: 60,
    y: 56,
  },
  {
    id: "farming",
    name: "Food & Farming",
    headline: "4",
    unit: "sustainability projects",
    blurb: "Poultry, vegetable gardens, fruit trees, and small businesses to feed and fund the home.",
    x: 67,
    y: 53,
  },
  {
    id: "registration",
    name: "Legal Registration",
    headline: "$1,000",
    unit: "to register the foundation",
    blurb: "Legal registration and compliance to expand partnerships, increase transparency, and open new doors.",
    x: 64,
    y: 58,
  },
];

export type ImageAsset = {
  src: string;
  alt: string;
  credit: string;
  source: string;
  position?: string;
};

export type ProgrammeStory = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tag: string;
  tone: "gold" | "green" | "blue";
};

// D10: no stock photographs of identifiable children paired with invented
// names, ages, or first-person quotes. These are programme-level descriptions
// of the work Sarah's Foundation does in Uganda. Real stories, with verified
// consent and non-identifying imagery, replace this in Phase 3.
export const featuredStories: ProgrammeStory[] = [
  {
    id: "care",
    title: "Daily care & protection",
    summary:
      "Every day, more than thirty children receive food, healthcare, and a safe place to sleep.",
    body: "Three meals a day, medical care when it's needed, counselling, and a loving household — the foundation of everything else we do.",
    tag: "Care & Protection",
    tone: "gold",
  },
  {
    id: "siblings",
    title: "Keeping siblings together",
    summary:
      "When a family is on the brink of separation, we work to keep brothers and sisters under the same roof.",
    body: "Sibling bonds are often all a child has left. Our programme prioritises keeping siblings together — a decision that shapes the rest of their lives.",
    tag: "A Permanent Home",
    tone: "green",
  },
  {
    id: "education",
    title: "School, every term",
    summary:
      "Tuition, books, uniforms, and the mentoring that keeps a child learning.",
    body: "Education is where the cycle of poverty breaks. We cover fees and materials, and pair each student with a mentor — including older children who were sponsored themselves.",
    tag: "Education & Skills",
    tone: "blue",
  },
];

export type Orphanage = {
  id: string;
  name: string;
  location: string;
  story: string;
  children: number;
  // D7: no `raised` figure until it is backed by a verified ledger (Phase 4).
  // `goal` is the planned, stakeholder-approved funding target only.
  goal: number;
  image: ImageAsset;
};

// Reframed as the foundation's concrete funding goals.
export const orphanages: Orphanage[] = [
  {
    id: "registration",
    name: "Foundation Registration",
    location: "Uganda",
    story:
      "Legal registration, documentation, and compliance — so we can expand partnerships, increase transparency, and open doors for future support.",
    children: 30,
    goal: 1000,
    image: {
      src: "https://images.unsplash.com/photo-1606607299522-14b35fc4679c?auto=format&fit=crop&w=1400&q=82",
      alt: "Paperwork and notes laid out on a wooden table",
      credit: "Denise Jans",
      source: "https://unsplash.com/s/photos/write-book",
      position: "50% 45%",
    },
  },
  {
    id: "permanent-home",
    name: "Permanent Children's Home",
    location: "Uganda",
    story:
      "Buying land and securing housing to give the children a safe, stable forever-home where they can grow and flourish.",
    children: 30,
    goal: 15000,
    image: {
      src: "https://images.unsplash.com/photo-1548102249-acdce64fffbd?auto=format&fit=crop&w=1400&q=82",
      alt: "Children running together across open ground",
      credit: "Seth Doyle",
      source: "https://unsplash.com/s/photos/african-school-children",
      position: "50% 48%",
    },
  },
  {
    id: "daily-care",
    name: "Daily Care & Feeding",
    location: "Uganda",
    story:
      "Food, school fees, medical care, clothing, and everyday essentials for more than 30 children throughout the year.",
    children: 30,
    goal: 9000,
    image: {
      src: "https://images.unsplash.com/photo-1705475388190-775066fd69a5?auto=format&fit=crop&w=1400&q=82",
      alt: "A variety of beans and cereals arranged in trays",
      credit: "Yoav Farhi",
      source: "https://unsplash.com/s/photos/pulses",
      position: "50% 50%",
    },
  },
];

export type SponsorTier = {
  amount: number;
  title: string;
  impact: string;
  featured?: boolean;
};

export const sponsorTiers: SponsorTier[] = [
  {
    amount: 25,
    title: "Provide & Nourish",
    impact: "Nutritious meals and school supplies for children in our care this month.",
  },
  {
    amount: 50,
    title: "Care & Protect",
    impact: "Medical care, counseling, and a safe bed for a child all year.",
    featured: true,
  },
  {
    amount: 100,
    title: "Educate & Empower",
    impact: "School fees, books, and materials for a child's education.",
  },
  {
    amount: 250,
    title: "Build a Home",
    impact: "A meaningful share of land and a permanent children's home.",
  },
];

export type TransparencyItem = {
  label: string;
  value: string;
  note: string;
};

// D8: "100% to the children" is removed pending Q4 — until the public finance
// projection is in place, we don't publish percentages we can't substantiate.
export const transparency: TransparencyItem[] = [
  { label: "Children today", value: "30+", note: "receiving food, care, and schooling every day." },
  { label: "Caring since", value: "2016", note: "nearly a decade of consistent, loving care." },
  { label: "Registration goal", value: "$1,000", note: "our next step toward full legal compliance." },
  { label: "Permanent home goal", value: "$15,000", note: "land and a forever-home for 40+ children." },
];

// D11: documents gain real anchors. Each `href` resolves to a published page
// or an in-page anchor on the home route — never `#`.
export type TransparencyDoc = { title: string; meta: string; href: string };

export const transparencyDocs: TransparencyDoc[] = [
  { title: "Our Story & Mission", meta: "Who we are & why", href: "/#story" },
  { title: "Funding Goals", meta: "Where every gift goes", href: "/#impact" },
  { title: "Safeguarding Policy", meta: "How we protect every child", href: "/safeguarding" },
  { title: "Privacy & Terms", meta: "How we handle your data", href: "/privacy" },
];

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  tone: "gold" | "green" | "blue";
};

export const testimonials: Testimonial[] = [
  {
    id: "partner",
    quote:
      "When I learned what these children were facing, I couldn't look away. Together with Leon, we're building something that lasts.",
    name: "James Scott Bowser",
    role: "Owner, Honest Need",
    tone: "blue",
  },
  {
    id: "director",
    quote:
      "Every day these children show me what hope looks like. With this partnership, we can finally give them a permanent home.",
    name: "Leon",
    role: "Operations, Sarah's Foundation Uganda",
    tone: "green",
  },
  {
    id: "beneficiary",
    quote:
      "This foundation gave me a home when I had none — food, school, and people who love me. I am living proof.",
    name: "A child in our care",
    role: "Sarah's Foundation Uganda",
    tone: "gold",
  },
];

export const finalCta = {
  eyebrow: "Join the movement",
  title: "Together we can build a future.",
  body: "You're not just giving — you're helping build a safe, permanent, loving home for vulnerable children in Uganda. Together we can provide hope, create opportunity, and change lives for generations.",
  primary: { label: "Donate Now", href: "/#sponsor" },
  secondary: { label: "Read Their Story", href: "/#story" },
};

// =============================================================================
// Volunteers — grassroots supporters who help from wherever they are.
// =============================================================================

export type VolunteerTask =
  | "social-media"
  | "text-marketing"
  | "email-marketing"
  | "flyer-distribution"
  | "wherever-needed";

export type VolunteerTaskOption = {
  id: VolunteerTask;
  icon: string;
  title: string;
  blurb: string;
  // When selected, prompt for the volunteer's mailing address.
  needsAddress?: boolean;
  // When selected, a phone number becomes required.
  needsPhone?: boolean;
};

export const volunteer = {
  eyebrow: "Get Involved",
  title: "Help from wherever you are.",
  lede: "You don't need to be in Uganda to change a child's life. Choose how you'd like to help — we'll send you everything you need to get started.",
  tasksLabel: "How would you like to help? Pick all that apply.",
  tasks: [
    {
      id: "social-media",
      icon: "📣",
      title: "Share on social media",
      blurb: "Post our content daily to reach new donors and supporters.",
    },
    {
      id: "text-marketing",
      icon: "💬",
      title: "Text-message outreach",
      blurb: "Share our mission with your contacts by text.",
      needsPhone: true,
    },
    {
      id: "email-marketing",
      icon: "📧",
      title: "Email outreach",
      blurb: "Forward our appeals to people who care.",
    },
    {
      id: "flyer-distribution",
      icon: "📄",
      title: "Hand out flyers",
      blurb: "We'll mail printed flyers to you to share in your area.",
      needsAddress: true,
    },
    {
      id: "wherever-needed",
      icon: "🙋",
      title: "Wherever I'm needed",
      blurb: "Tell us your skills — we'll find the right way to plug you in.",
    },
  ] as VolunteerTaskOption[],
  consentLabel:
    "I agree to be contacted about volunteering. We'll never sell your data.",
  reassure: "🔒 Your details are kept private and used only to coordinate volunteering.",
  submitLabel: "Count me in",
  submittingLabel: "Signing you up…",
  errorMessage: "Something went wrong — please try again, or email us directly.",
  successTitle: "You're in! 💛",
  successBody:
    "Watch your inbox for your first share-pack. Want to start spreading the word right now?",
  successShareLabel: "Share now:",
};

// D11: every link resolves to a real destination — either an in-page anchor
// on `/` or a published route — never `#`.
export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };

export const footer: {
  blurb: string;
  columns: FooterColumn[];
  contact: { email: string; phone: string };
} = {
  blurb:
    "Sarah's Foundation Uganda provides hope, home, and opportunity to vulnerable children — in partnership with Honest Need.",
  columns: [
    {
      title: "Foundation",
      links: [
        { label: "Our Story", href: "/#story" },
        { label: "What We Need", href: "/#impact" },
        { label: "Stories", href: "/#stories" },
        { label: "Transparency", href: "/#transparency" },
      ],
    },
    {
      title: "Get Involved",
      links: [
        { label: "Donate", href: "/#sponsor" },
        { label: "Volunteer", href: "/#volunteer" },
        { label: "Share our story", href: "/#stories" },
      ],
    },
    {
      title: "Trust",
      links: [
        { label: "Privacy policy", href: "/privacy" },
        { label: "Terms of use", href: "/terms" },
        { label: "Safeguarding", href: "/safeguarding" },
        { label: "Contact", href: "mailto:hello@honestneed.com" },
      ],
    },
  ],
  contact: { email: "hello@honestneed.com", phone: "Honest Need · HonestNeed.com" },
};
