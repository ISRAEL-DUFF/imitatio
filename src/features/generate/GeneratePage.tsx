import { useParams } from 'react-router';
import { PageStub } from '@/components/PageStub';

export function GeneratePage() {
  const { id } = useParams();

  return (
    <PageStub title="Generate">
      <p>
        Compose new text from pattern <code>{id}</code>. Arrives in M4.
      </p>
    </PageStub>
  );
}
