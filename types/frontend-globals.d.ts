declare const catalogSearch: any;
declare const $: (id: string) => HTMLElement | null;

interface Window {
  BargigFavorites?: {
    createStore?: (options: { storage: Storage | null }) => unknown;
  };
}
