/** Sibling consolecheat tools. This site (Controller-Tester, ex3) is not listed. */
export type ToolLink = {
  id: string;
  label: string;
  href: string;
};

export const OTHER_TOOLS: readonly ToolLink[] = [
  { id: "title-id", label: "Title-ID-Finder", href: "https://robfreak.github.io/consolecheat-ex1/" },
  { id: "ps-plus", label: "PS-Plus-Archiv", href: "https://robfreak.github.io/consolecheat-ex2/" },
  { id: "save-info", label: "Save-Info-Leser", href: "https://robfreak.github.io/consolecheat-ex4/" },
  { id: "error-codes", label: "Fehlercode-Nachschlager", href: "https://robfreak.github.io/consolecheat-ex5/" },
  { id: "watchlist", label: "Spiele-Merkliste", href: "https://robfreak.github.io/consolecheat-ex6/" },
  { id: "screen-test", label: "Bildschirm-Test", href: "https://robfreak.github.io/consolecheat-ex6/bildschirm/" },
];

const screenTest = OTHER_TOOLS.find((tool) => tool.id === "screen-test");
if (!screenTest) throw new Error("Bildschirm-Test missing from OTHER_TOOLS");

export const SCREEN_TEST: ToolLink = screenTest;
