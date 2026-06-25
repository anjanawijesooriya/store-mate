export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <span className="text-2xl font-bold text-primary-foreground">SM</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">StoreMate</h1>
          <p className="text-sm text-muted-foreground mt-1">Smart shop management</p>
        </div>
        {children}
      </div>
    </div>
  );
}
