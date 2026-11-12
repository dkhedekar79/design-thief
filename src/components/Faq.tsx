import { useState } from 'react';

const items = [
  {
    question: 'Is this allowed? Can I really copy a site’s design?',
    answer:
      'Design Thief reads CSS that the site already serves to every visitor, and reports its colours, type, spacing and shape. That is reference material: use it to learn a visual language or to build something in the same spirit. Do not reuse another company’s logo, wordmark, photography, illustrations or copy — the generated Claude Code prompt tells the model to leave those out.',
  },
  {
    question: 'Does it read the rendered page or just the stylesheets?',
    answer:
      'Stylesheets, inline styles and the HTML. It does not run a browser, so it cannot report computed font sizes after JavaScript, scroll effects or canvas artwork. Declared values are usually the ones a designer committed to, which is what you want in a design system anyway.',
  },
  {
    question: 'Why did my site fail to load?',
    answer:
      'Some sites block bot traffic, put styles behind a login, or ship CSS from a CDN that refuses server requests. Local and private addresses are blocked on purpose. If the homepage fails, try another page on the same domain, or a public site you like instead.',
  },
  {
    question: 'Where do the fonts come from?',
    answer:
      'The font families are read from font-family declarations and from Google Fonts links. Design Thief does not bundle or download the font files, so check the licence for each family before you ship it. Geist, Inter and most Google-hosted families are free to use.',
  },
  {
    question: 'Is anything stored or sent anywhere else?',
    answer:
      'No account, no database, no analytics. The URL is fetched by your own server, the result is returned to the browser, and nothing is kept after the request. Self-host it and the only outbound calls are the sites you ask it to read.',
  },
  {
    question: 'Can I use it commercially and self-host it?',
    answer:
      'Yes. It is MIT licensed. Run it locally with npm run dev, or build it and run the included Node server behind your own domain. The only thing it needs is outbound HTTPS.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="faq" id="faq">
      <div className="container">
        <div className="section-head faq-head">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2 className="section-title">Questions.</h2>
            <p className="section-lede">What it reads, what it will not do, and how to use it fairly.</p>
          </div>
        </div>
        <div className="faq-list">
          {items.map((item, index) => {
            const expanded = open === index;
            return (
              <div key={item.question} className={`faq-item ${expanded ? 'is-open' : ''}`}>
                <h3>
                  <button
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? -1 : index)}
                    className="faq-question"
                  >
                    <span>{item.question}</span>
                    <span className="faq-toggle" aria-hidden="true">
                      {expanded ? '−' : '+'}
                    </span>
                  </button>
                </h3>
                {expanded && <p className="faq-answer">{item.answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
