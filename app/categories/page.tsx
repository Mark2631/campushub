import Link from 'next/link';
import { ArrowRight, BookOpen, BriefcaseBusiness, Cable, ChefHat, CircleHelp, Shirt, Sofa, Wrench, Recycle, Users, Building2, UsersRound } from 'lucide-react';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';

const categories = [
  { name: 'Electronics', description: 'Phones, laptops, accessories and gadgets', Icon: Cable, label: 'Tech & accessories' },
  { name: 'Books', description: 'Textbooks, revision guides and study materials', Icon: BookOpen, label: 'Study essentials' },
  { name: 'Fashion', description: 'Clothing, shoes, bags and personal style', Icon: Shirt, label: 'Wear & carry' },
  { name: 'Furniture', description: 'Room essentials, desks and everyday storage', Icon: Sofa, label: 'Living spaces' },
  { name: 'Food', description: 'Meals, snacks and campus food businesses', Icon: ChefHat, label: 'Food & groceries' },
  { name: 'Services', description: 'Repairs, design, tutoring and useful skills', Icon: Wrench, label: 'Skills & services' },
  { name: 'Refurbished', description: 'Pre-owned and professionally restored finds', Icon: Recycle, label: 'Value finds' },
  { name: 'Accommodation', description: 'Rooms and rentals around your campus', Icon: Building2, label: 'Find a place' },
  { name: 'Roommates', description: 'Find someone to share a room or flat with', Icon: UsersRound, label: 'Share a space' },
  { name: 'Business', description: 'Discover registered campus-area businesses', Icon: BriefcaseBusiness, label: 'Local businesses' },
  { name: 'Other', description: 'Useful items and services that need their own space', Icon: CircleHelp, label: 'More to explore' },
];

export default function CategoriesPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand)]">Shop by category</p>
            <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.055em] sm:text-[38px]">Explore the marketplace</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">Start with what you need, then narrow your search to listings and sellers around your campus.</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs font-bold text-[var(--foreground)] transition hover:border-[var(--brand)] sm:self-auto">Back to home <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <section aria-label="All marketplace categories" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(({ name, description, Icon, label }) => (
            <Link key={name} href={'/?category=' + encodeURIComponent(name)} className="group flex min-h-[142px] items-center gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)]/50 hover:shadow-[0_12px_34px_rgba(18,45,30,.08)]">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]"><Icon className="h-6 w-6" strokeWidth={1.7} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</span>
                <span className="mt-1 block text-base font-bold tracking-[-0.02em] text-[var(--foreground)]">{name}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{description}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-hover:translate-x-1 group-hover:text-[var(--brand)]" aria-hidden="true" />
            </Link>
          ))}
        </section>
        <section className="mt-9 grid gap-3 sm:grid-cols-2">
          <Link href="/?mode=Products" className="flex items-center justify-between gap-3 rounded-[20px] bg-[var(--brand)] p-5 text-white transition hover:bg-[var(--brand-strong)]">
            <span><span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Browse products</span><span className="mt-1 block text-lg font-bold">Find something useful</span><span className="mt-1 block text-xs text-white/75">Compare listings from students and local sellers</span></span><ArrowRight className="h-5 w-5 shrink-0" />
          </Link>
          <Link href="/community" className="flex items-center justify-between gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--brand)]/50">
            <span><span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Campus community</span><span className="mt-1 block text-lg font-bold text-[var(--foreground)]">Connect with students</span><span className="mt-1 block text-xs text-[var(--muted)]">Join conversations and campus groups</span></span><Users className="h-6 w-6 shrink-0 text-[var(--brand)]" />
          </Link>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
