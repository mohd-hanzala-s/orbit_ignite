import { Link } from 'react-router-dom';
import { Mascot } from '@/components/space/Mascot';
import { LinkButton } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <Mascot mood="oops" size={170} />
        <div className="mt-4 font-display text-7xl font-bold tracking-tight"><span className="text-gradient">404</span></div>
        <h1 className="mt-2 font-display text-2xl font-semibold">Lost in space</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">We couldn't find that page. Comet checked every orbit — let's get you back to base.</p>
        <div className="mt-7 flex justify-center gap-3"><LinkButton to="/" variant="primary">Back to Launchpad</LinkButton><LinkButton to="/catalog" variant="secondary">Explore catalog</LinkButton></div>
        <Link to="/" className="sr-only">Home</Link>
      </div>
    </div>
  );
}
