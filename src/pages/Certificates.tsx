import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Award, Download, Printer, ShieldCheck, ShieldX, ArrowLeft } from 'lucide-react';
import { useGet } from '@/lib/queries';
import type { Certificate } from '@/lib/types';
import { dateFmt } from '@/lib/utils';
import { CourseCover } from '@/components/space/CourseCover';
import { LogoMark } from '@/components/space/Logo';
import { Mascot } from '@/components/space/Mascot';
import { Button, LinkButton } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton, ErrorState } from '@/components/ui/misc';
import { Starfield } from '@/components/space/Starfield';

export function CertificateArt({ c, className }: { c: Pick<Certificate, 'learner' | 'course' | 'issuedAt' | 'code' | 'score' | 'signer' | 'signerTitle' | 'platform' | 'theme' | 'courseId'>; className?: string }) {
  return (
    <div className={`relative aspect-[1.414/1] w-full overflow-hidden rounded-[22px] border border-[#8b6cff]/40 bg-[#070a1c] text-white shadow-2xl ${className ?? ''}`} style={{ containerType: 'inline-size' }}>
      <div className="absolute inset-0 opacity-70"><CourseCover theme={c.theme} seed={c.courseId} rounded={false} className="scale-150 blur-sm" /></div>
      <div className="absolute inset-0 bg-gradient-to-br from-[#070a1c]/55 via-[#070a1c]/78 to-[#070a1c]/90" />
      <div className="absolute inset-[2.2cqw] rounded-[14px] border border-white/20" />
      <div className="absolute inset-[3cqw] rounded-[10px] border border-[#a78bff]/30" />
      <div className="relative flex h-full flex-col items-center justify-center px-[9cqw] text-center">
        <div className="flex items-center gap-[1cqw]"><LogoMark size={36} /><span className="font-display text-[2.4cqw] font-bold tracking-wide">{c.platform}</span></div>
        <div className="mt-[2.6cqw] text-[1.25cqw] font-semibold uppercase tracking-[0.5em] text-[#a78bff]">Certificate of Completion</div>
        <div className="mt-[1.8cqw] text-[1.4cqw] text-white/70">This certifies that</div>
        <div className="mt-[0.8cqw] bg-gradient-to-r from-white via-[#c9b8ff] to-[#7be9ff] bg-clip-text font-display text-[5.2cqw] font-bold leading-tight text-transparent">{c.learner}</div>
        <div className="mt-[1.4cqw] text-[1.4cqw] text-white/70">has successfully completed the mission</div>
        <div className="mt-[0.8cqw] max-w-[70cqw] font-display text-[2.8cqw] font-semibold leading-snug">{c.course}</div>
        {c.score != null && <div className="mt-[1cqw] text-[1.3cqw] text-white/60">with an average assessment score of {c.score}%</div>}
        <div className="mt-[3.2cqw] flex w-full items-end justify-between text-[1.15cqw]">
          <div className="text-left"><div className="text-white/50">Issued</div><div className="font-semibold">{dateFmt(c.issuedAt)}</div></div>
          <div className="text-center"><div className="font-display text-[2cqw] italic text-[#c9b8ff]" style={{ fontFamily: 'cursive' }}>{c.signer}</div><div className="mx-auto mt-[0.3cqw] h-px w-[16cqw] bg-white/30" /><div className="mt-[0.4cqw] text-white/50">{c.signerTitle}</div></div>
          <div className="text-right"><div className="text-white/50">Certificate ID</div><div className="font-mono font-semibold tracking-wider">{c.code}</div></div>
        </div>
      </div>
      <div className="absolute bottom-[2%] right-[3%] opacity-95"><Mascot mood="cheer" size={92} float={false} /></div>
    </div>
  );
}

export function CertificatesPage() {
  const { data, isLoading, error, refetch } = useGet<Certificate[]>('/me/certificates');
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <PageHeader eyebrow="Proof of mission" title="Certificates" description="Your earned certificates. Each one has a unique ID anyone can verify." />
      {isLoading ? <div className="grid gap-5 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-72" />)}</div> : !data?.length ? <div className="surface"><EmptyState mood="cheer" title="No certificates yet" description="Complete a course with certification enabled to earn your first one." action={<LinkButton to="/catalog" variant="primary">Find a course</LinkButton>} /></div> : (
        <div className="grid gap-6 md:grid-cols-2">
          {data.map((c) => (
            <div key={c.id} className="surface surface-hover group overflow-hidden p-4">
              <Link to={`/certificates/${c.id}`}><CertificateArt c={c} /></Link>
              <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-4">
                <div className="min-w-0"><div className="truncate font-display font-semibold">{c.course}</div><div className="text-xs text-muted">Issued {dateFmt(c.issuedAt)} · {c.code}</div></div>
                <LinkButton to={`/certificates/${c.id}`} size="sm" variant="secondary" icon={<Award className="size-4" />}>Open</LinkButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CertificateView() {
  const { id } = useParams();
  const { data } = useGet<Certificate[]>('/me/certificates');
  const c = data?.find((x) => String(x.id) === id);
  if (!data) return <Skeleton className="h-[600px]" />;
  if (!c) return <div className="surface"><EmptyState title="Certificate not found" description="It may belong to another account." action={<LinkButton to="/certificates">Back to certificates</LinkButton>} /></div>;
  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/certificates" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" /> All certificates</Link>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<ShieldCheck className="size-4" />} onClick={() => { navigator.clipboard?.writeText(`${location.origin}/verify/${c.code}`); toast.success('Verification link copied'); }}>Copy verify link</Button>
          <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print / Save PDF</Button>
        </div>
      </div>
      <div className="print-only-cert"><CertificateArt c={c} /></div>
      <p className="no-print mt-5 text-center text-sm text-muted"><Download className="mr-1 inline size-4" /> Use “Save as PDF” in the print dialog to download.</p>
    </div>
  );
}

export function VerifyPage() {
  const { code } = useParams();
  const { data, error, isLoading } = useGet<{ valid: boolean; code: string; learner: string; course: string; issuedAt: string; score: number | null }>(`/certificates/verify/${code}`);
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <Starfield />
      <div className="surface w-full max-w-md p-8 text-center">
        {isLoading ? <Skeleton className="h-40" /> : error || !data ? (
          <><div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-danger/15 text-danger"><ShieldX className="size-8" /></div><h1 className="font-display text-2xl font-bold">Certificate not found</h1><p className="mt-2 text-sm text-muted">We couldn't find a certificate with ID <span className="font-mono">{code}</span>.</p></>
        ) : (
          <><div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-success/15 text-success"><ShieldCheck className="size-8" /></div><h1 className="font-display text-2xl font-bold">Verified certificate</h1><dl className="mt-6 space-y-3 text-left text-sm"><div className="flex justify-between gap-4"><dt className="text-muted">Awarded to</dt><dd className="font-semibold">{data.learner}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Course</dt><dd className="text-right font-semibold">{data.course}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Issued</dt><dd className="font-semibold">{dateFmt(data.issuedAt)}</dd></div>{data.score != null && <div className="flex justify-between gap-4"><dt className="text-muted">Score</dt><dd className="font-semibold">{data.score}%</dd></div>}<div className="flex justify-between gap-4"><dt className="text-muted">ID</dt><dd className="font-mono font-semibold">{data.code}</dd></div></dl></>
        )}
        <LinkButton to="/" variant="ghost" className="mt-6">Go to Orbit Ignite</LinkButton>
      </div>
    </div>
  );
}
