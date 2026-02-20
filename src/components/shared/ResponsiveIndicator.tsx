export function ResponsiveIndicator() {
  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-lg text-xs font-mono opacity-80">
      <span className="hidden sm:inline md:hidden">SM</span>
      <span className="hidden md:inline lg:hidden">MD</span>
      <span className="hidden lg:inline xl:hidden">LG</span>
      <span className="hidden xl:inline 2xl:hidden">XL</span>
      <span className="hidden 2xl:inline">2XL</span>
      <span className="inline sm:hidden">XS</span>
    </div>
  );
}
