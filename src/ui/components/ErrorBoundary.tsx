import { Component, type ReactNode } from 'react';

/** Beklenmeyen bir hatada boş ekran yerine açıklama gösterir. Veriler IndexedDB'de güvende kalır. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-bold">Bir şeyler ters gitti</h1>
        <p className="mt-2 text-[14px] text-muted">Kayıtların cihazında güvende; bu hata onları silmez. Sayfayı yenilemeyi dene. Sorun sürerse Profil › Veri bölümünden yedek alabilirsin.</p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-sunk p-3 text-left text-[12px] text-muted">{this.state.error.message}</pre>
        <button type="button" onClick={() => location.reload()} className="mt-4 h-11 rounded-xl bg-teal px-5 font-semibold text-white">
          Yenile
        </button>
      </div>
    );
  }
}
