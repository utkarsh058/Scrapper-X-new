import React from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowLeft, ExternalLink, Smartphone, Monitor } from 'lucide-react';

interface DemoPreviewPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DemoPreviewPage({ params }: DemoPreviewPageProps) {
  const { slug } = await params;
  const demo = await prisma.websiteDemo.findUnique({
    where: { previewSlug: slug },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          category: true,
          city: true,
          phone: true,
          websiteUrl: true,
        },
      },
    },
  });

  if (!demo || !demo.htmlContent) {
    notFound();
  }

  let improvements: string[] = [];
  try {
    if (demo.improvementsApplied) {
      improvements = JSON.parse(demo.improvementsApplied);
    }
  } catch {}

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      {/* Top Banner Toolbar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">{demo.businessName}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Proposed Redesign
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {demo.industry} · {demo.lead?.city || 'India'}
            </p>
          </div>
        </div>

        {/* Audit Improvements Addressed */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Grounded Fixes:</span>
          {improvements.slice(0, 3).map((imp, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {imp.length > 32 ? `${imp.slice(0, 32)}...` : imp}
            </span>
          ))}
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2">
          {demo.originalUrl && (
            <a
              href={demo.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              Original Site
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}
        </div>
      </header>

      {/* Rendered HTML Container */}
      <main className="flex-1 flex justify-center bg-slate-950 p-4">
        <div className="w-full max-w-6xl bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col h-[calc(100vh-80px)]">
          <iframe
            srcDoc={demo.htmlContent}
            title={`Preview for ${demo.businessName}`}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </main>
    </div>
  );
}
