import Link from 'next/link';

export const metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description:
    'Answers to common questions about Paw Cities: free accounts, dog profiles, check-ins, reviews, events, business listings, and the City Ambassador program.',
};

interface QA {
  question: string;
  answer: React.ReactNode;
}

function FaqSection({ title, items }: { title: string; items: QA[] }) {
  return (
    <section className="bg-white rounded-xl border p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <details
            key={item.question}
            className="group border border-gray-500 rounded-lg"
          >
            <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer rounded-lg hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600">
              <h3 className="text-sm font-semibold text-gray-900">
                {item.question}
              </h3>
              <span
                aria-hidden="true"
                className="shrink-0 text-gray-500 transition-transform group-open:rotate-180"
              >
                &#9662;
              </span>
            </summary>
            <div className="px-4 pb-4 text-sm text-gray-600">{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

const linkClass =
  'text-orange-700 font-semibold underline hover:text-orange-800';

const dogOwnerFaqs: QA[] = [
  {
    question: 'Is Paw Cities free to use?',
    answer: (
      <p>
        Yes. Registering for an account is completely free, and so are dog
        profiles, check-ins, reviews, favorites, and packs.
      </p>
    ),
  },
  {
    question: 'What is a dog profile, and is it public?',
    answer: (
      <p>
        A dog profile is a page for your dog with its own URL under{' '}
        <Link href="/dogs" className={linkClass}>
          /dogs
        </Link>
        . Profiles are opt-in: your dog only gets a public page if you choose
        to create one.
      </p>
    ),
  },
  {
    question: 'Do I need an account to check in or leave a review?',
    answer: (
      <p>
        Yes — check-ins and reviews require an account, but accounts are free
        and take under a minute to set up. You can browse places and events
        without one.
      </p>
    ),
  },
  {
    question: 'Do my favorites carry over between cities?',
    answer: (
      <p>
        Yes. Favorites work across all of our cities, so you can save a cafe
        in Paris and a beach in Sydney to the same list.
      </p>
    ),
  },
  {
    question: 'How do I know the events are real and up to date?',
    answer: (
      <p>
        Every event on our calendar is verified daily. If something gets
        cancelled or rescheduled, we catch it.
      </p>
    ),
  },
  {
    question: 'Can I submit an event?',
    answer: (
      <p>
        Absolutely — anyone can submit an event through the city pages or by
        emailing us. We verify it before it goes live on the calendar.
      </p>
    ),
  },
  {
    question: 'Is the newsletter tied to my account?',
    answer: (
      <p>
        No — the newsletter is a separate subscription. You can sign up for it
        without creating an account, and having an account doesn&apos;t
        automatically subscribe you.
      </p>
    ),
  },
  {
    question: 'I requested a password reset but nothing arrived. What now?',
    answer: (
      <p>
        Password reset links arrive by email — give it a couple of minutes and
        check your spam folder. If it still hasn&apos;t shown up, request a new
        one or contact us.
      </p>
    ),
  },
];

const businessFaqs: QA[] = [
  {
    question: 'How do I claim my business listing?',
    answer: (
      <p>
        Claiming your listing is free. Head to{' '}
        <Link href="/business" className={linkClass}>
          /business
        </Link>{' '}
        and follow the claim flow to take control of your page and keep your
        dog-friendly details accurate.
      </p>
    ),
  },
  {
    question: 'Does a listing cost anything?',
    answer: (
      <p>
        A basic listing is free to claim and manage. We also offer paid plans
        with extra features — <Link href="/business" className={linkClass}>get in touch through your business
        dashboard</Link> and we&apos;ll walk you through the options.
      </p>
    ),
  },
];

const ambassadorFaqs: QA[] = [
  {
    question: 'What is the City Ambassador program?',
    answer: (
      <p>
        City Ambassadors are locals on the ground in each of our cities who
        scout new places and help keep listings honest. The program is
        invite-only — you can apply at{' '}
        <Link href="/ambassadors" className={linkClass}>
          /ambassadors
        </Link>
        .
      </p>
    ),
  },
  {
    question: 'Are there different ambassador levels?',
    answer: (
      <p>
        Yes — the program has three tiers: Explorer, Trailblazer, and Pack
        Leader. You can learn more on the{' '}
        <Link href="/ambassadors" className={linkClass}>
          ambassadors page
        </Link>
        .
      </p>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white py-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Everything you need to know about Paw Cities — for dog owners,
            businesses, and future ambassadors.
          </p>
        </div>
      </section>

      <div className="container mx-auto max-w-3xl px-4 py-10 space-y-8">
        <FaqSection title="For Dog Owners" items={dogOwnerFaqs} />
        <FaqSection title="For Businesses" items={businessFaqs} />
        <FaqSection title="Ambassador Program" items={ambassadorFaqs} />

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center">
          <p className="font-semibold text-gray-900 mb-1">
            Still have a question?
          </p>
          <p className="text-sm text-gray-600">
            Email us at{' '}
            <a href="mailto:eric@pawcities.com" className={linkClass}>
              eric@pawcities.com
            </a>{' '}
            and we&apos;ll get back to you.
          </p>
        </div>
      </div>
    </div>
  );
}
