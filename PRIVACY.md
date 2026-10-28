# Atrio privacy policy

Effective 28 October 2026. This policy covers the Atrio browser extension, as published on the Chrome Web Store and
in this repository. [Italiano più sotto](#informativa-sulla-privacy-di-atrio).

## In short

- Atrio has no server. Its developer receives none of your data: there is no account, no analytics, no telemetry and
  no advertising.
- What you enter in Atrio is stored by your browser, on your device, and stays there until you delete it.
- Data leaves your device only when you act: when you search or open a link, the site you go to receives that
  request, as with any navigation; and, only if you turn them on, online search suggestions send what you type to
  Google or DuckDuckGo.

## What Atrio stores, and where

Everything below is kept in the extension's own storage in your browser (`localStorage` and IndexedDB). Websites
cannot read it.

| Data                                                                                                                                                                                                         | Kept until                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Your name, preferences, quick links, search prefixes, tasks, notes, custom CSS, the focus timer and its statistics (daily counts for up to 140 days), the Google account number chosen for the apps launcher | You change it, reset Atrio or uninstall it                                     |
| Recent searches: up to 30, of up to 200 characters each                                                                                                                                                      | You clear them, turn them off (which clears them), reset Atrio or uninstall it |
| Your own wallpapers: up to eight images                                                                                                                                                                      | You remove them, reset Atrio or uninstall it                                   |
| A copy of a save that could not be read, kept so that nothing is silently lost                                                                                                                               | You reset Atrio or uninstall it                                                |

Atrio does not read your browsing history, your cookies or the content of the sites you visit.

## When data leaves your device

- **Searches.** A web search goes to the search engine set in your browser, through Chrome's Search API. If you chose
  Google, DuckDuckGo or GitHub in Settings, or used a search prefix (such as `gh` or `npm`), it goes to that site
  instead. That site receives your query as with any search, and its privacy policy applies.
- **Links and the Google apps launcher.** Opening a link or an app takes you to that site. The launcher adds the
  account number you picked (`authuser`) to the address: Atrio never signs in and has no access to your Google
  accounts.
- **Online search suggestions, off by default.** If you turn them on, what you type in the search box is sent, as you
  type, to the suggestion service of your search engine: Google (`suggestqueries.google.com`) or DuckDuckGo
  (`duckduckgo.com`). The requests go over HTTPS, without cookies and without a referrer, but the service sees the text
  and your IP address. Chrome asks your permission to contact the service when you turn suggestions on; turning them
  off removes that permission. Google's and DuckDuckGo's privacy policies apply to those requests.
- **Site icons** of quick links come from Chrome's local favicon cache: no request is made for them.

Nothing else is sent. The extension's content security policy only lets the page connect to those two suggestion
services and load images from the extension itself, so custom CSS, yours or from an imported backup, cannot contact a
server either.

## Backups

**Export backup** saves a JSON file on your computer with your links, tasks, notes, recent searches, preferences and
wallpapers. The file is not encrypted: keep it as carefully as the data in it. **Import backup** replaces your current
data, after asking you.

## Deleting your data

- **Settings → Data → Reset settings and data** deletes everything Atrio stores, wallpapers included.
- **Settings → General → Clear recent searches** deletes the recent searches alone.
- Uninstalling the extension makes the browser delete all of its storage.

## Timer notifications

The focus timer schedules a browser alarm and shows a notification on your device when a session ends. Nothing is
sent anywhere.

## Sharing and selling

The developer does not collect your data, so does not sell it, share it or use it for any purpose, such as
advertising or creditworthiness. It reaches a third party only as described above, when you search, open a link, or
use the suggestions you turned on.

## Changes

A new version of this policy is published in this file, in the extension's repository, with a new effective date, and
noted in the changelog.

## Contact

Questions about this policy: open an issue at <https://github.com/gurmilans-dev/atrio/issues>.

---

# Informativa sulla privacy di Atrio

In vigore dal 28 ottobre 2026. Questa informativa riguarda l'estensione Atrio, come pubblicata sul Chrome Web Store e
in questo repository.

## In breve

- Atrio non ha un server. Lo sviluppatore non riceve nessun tuo dato: niente account, statistiche d'uso, telemetria o
  pubblicità.
- Quello che inserisci in Atrio è salvato dal browser, sul tuo dispositivo, e ci resta finché non lo cancelli.
- I dati escono dal dispositivo solo per una tua azione: quando cerchi o apri un collegamento, il sito di destinazione
  riceve quella richiesta, come in ogni navigazione; e, solo se li attivi, i suggerimenti di ricerca online inviano
  quello che scrivi a Google o DuckDuckGo.

## Cosa salva Atrio, e dove

Tutto ciò che segue resta nello spazio dell'estensione nel tuo browser (`localStorage` e IndexedDB). I siti web non
possono leggerlo.

| Dati                                                                                                                                                                                                                     | Conservati finché                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Nome, preferenze, collegamenti rapidi, prefissi di ricerca, attività, note, CSS personale, il timer focus e le sue statistiche (conteggi giornalieri fino a 140 giorni), il numero dell'account Google scelto per le app | Non li modifichi, ripristini Atrio o lo disinstalli                                   |
| Ricerche recenti: fino a 30, di 200 caratteri al massimo                                                                                                                                                                 | Non le cancelli, le disattivi (il che le cancella), ripristini Atrio o lo disinstalli |
| Sfondi personali: fino a otto immagini                                                                                                                                                                                   | Non li rimuovi, ripristini Atrio o lo disinstalli                                     |
| Una copia di un salvataggio illeggibile, tenuta perché niente vada perso in silenzio                                                                                                                                     | Non ripristini Atrio o lo disinstalli                                                 |

Atrio non legge la cronologia, i cookie o il contenuto dei siti che visiti.

## Quando i dati escono dal dispositivo

- **Ricerche.** Una ricerca web va al motore di ricerca impostato nel browser, tramite la Search API di Chrome. Se in
  Impostazioni hai scelto Google, DuckDuckGo o GitHub, o hai usato un prefisso (come `gh` o `npm`), va invece a quel
  sito. Il sito riceve la ricerca come in ogni altra ricerca, e vale la sua informativa.
- **Collegamenti e app Google.** Aprire un collegamento o un'app porta a quel sito. Il launcher aggiunge all'indirizzo
  il numero dell'account scelto (`authuser`): Atrio non accede mai ai tuoi account Google.
- **Suggerimenti di ricerca online, disattivati in partenza.** Se li attivi, quello che scrivi nella casella di ricerca
  viene inviato, mentre scrivi, al servizio di suggerimenti del motore scelto: Google (`suggestqueries.google.com`) o
  DuckDuckGo (`duckduckgo.com`). Le richieste viaggiano in HTTPS, senza cookie e senza referrer, ma il servizio vede il
  testo e il tuo indirizzo IP. Chrome chiede il permesso di contattare il servizio quando li attivi; disattivarli
  rimuove il permesso. A queste richieste si applicano le informative di Google e DuckDuckGo.
- **Le icone dei siti** dei collegamenti rapidi vengono dalla cache locale di Chrome: per esse non parte nessuna
  richiesta.

Non viene inviato nient'altro. La content security policy dell'estensione permette alla pagina di collegarsi solo a
quei due servizi di suggerimenti e di caricare immagini solo dall'estensione stessa: nemmeno il CSS personale, tuo o
arrivato con un backup importato, può contattare un server.

## Backup

**Esporta backup** salva sul tuo computer un file JSON con collegamenti, attività, note, ricerche recenti, preferenze e
sfondi. Il file non è cifrato: custodiscilo come i dati che contiene. **Importa backup** sostituisce i dati attuali,
dopo averti chiesto conferma.

## Cancellare i dati

- **Impostazioni → Dati → Ripristina impostazioni e dati** cancella tutto ciò che Atrio salva, sfondi compresi.
- **Impostazioni → Generale → Cancella le ricerche recenti** cancella solo le ricerche recenti.
- Disinstallando l'estensione, il browser cancella tutto il suo spazio di archiviazione.

## Notifiche del timer

Il timer focus programma un allarme del browser e mostra una notifica sul tuo dispositivo alla fine di una sessione.
Non viene inviato nulla.

## Condivisione e vendita

Lo sviluppatore non raccoglie i tuoi dati, quindi non li vende, non li cede e non li usa per alcuno scopo, come
pubblicità o valutazioni di affidabilità creditizia. Arrivano a terzi solo come descritto sopra, quando cerchi, apri un
collegamento o usi i suggerimenti che hai attivato.

## Modifiche

Una nuova versione di questa informativa viene pubblicata in questo file, nel repository dell'estensione, con una nuova
data di entrata in vigore, e indicata nel changelog.

## Contatti

Domande su questa informativa: apri una issue su <https://github.com/gurmilans-dev/atrio/issues>.
