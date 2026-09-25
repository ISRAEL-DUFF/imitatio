import { Section } from '@/components/ui';

// The permanent note on the limits of the analyses (spec §12).
export function AboutSection() {
  return (
    <Section title="About these analyses">
      <div className="max-w-prose space-y-2 text-sm">
        <p>
          Every analysis and every composition in Imitatio is written by a language model. There is no parser or
          treebank behind it, so it will sometimes be wrong: a misparsed form, a construction misnamed, a word order
          explained with more confidence than it deserves.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Each note and token carries the model’s own confidence. Treat “low” as a question, not an answer.</li>
          <li>
            Grammar references are marked <em>unverified</em>. Section numbers produced by a model can be wrong; check
            them in the grammar itself.
          </li>
          <li>
            The warning badges come from checks the app can run itself: quoted words that are not in the passage, a
            token table that does not line up, unknown keys, missing connectives. Passing them does not make an
            analysis right.
          </li>
          <li>You are the final authority: everything can be edited, and edited patterns are marked as yours.</li>
          <li>
            Generated text is always labelled a <em>composition</em>. It is practice material, never authentic Greek or
            Latin, and never to be quoted as such.
          </li>
        </ul>
        <p className="text-muted">
          Your notebook is stored only in this browser. The only data that leaves it is the passage or pattern you send
          for analysis or generation, which goes to OpenRouter with your key.
        </p>
      </div>
    </Section>
  );
}
