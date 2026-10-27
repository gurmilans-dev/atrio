// HTTP status codes for the "http" palette tool: the standard reason phrase, then a short
// explanation in Italian and in English. Codes not listed are described by their class.
export const HTTP_STATUS = {
  100: [
    'Continue',
    'Intestazioni ricevute: il client può inviare il corpo della richiesta.',
    'Headers received: the client can send the request body.',
  ],
  101: [
    'Switching Protocols',
    'Il server passa al protocollo richiesto, per esempio WebSocket.',
    'The server switches to the requested protocol, e.g. WebSocket.',
  ],
  103: [
    'Early Hints',
    'Suggerimenti anticipati: il browser può iniziare a caricare risorse prima della risposta.',
    'Early hints: the browser can start loading resources before the response.',
  ],
  200: ['OK', 'Richiesta riuscita.', 'The request succeeded.'],
  201: [
    'Created',
    'Risorsa creata; di solito l’header Location indica dove.',
    'A resource was created; the Location header usually points to it.',
  ],
  202: [
    'Accepted',
    'Accettata ma non ancora elaborata (lavoro asincrono).',
    'Accepted but not processed yet (asynchronous work).',
  ],
  204: ['No Content', 'Riuscita, senza corpo nella risposta.', 'Succeeded, with no response body.'],
  206: [
    'Partial Content',
    'Solo una parte della risorsa, come chiesto con l’header Range.',
    'Part of the resource, as asked with a Range header.',
  ],
  301: [
    'Moved Permanently',
    'Spostata per sempre all’URL in Location; i motori di ricerca aggiornano il link.',
    'Moved for good to the URL in Location; search engines update the link.',
  ],
  302: [
    'Found',
    'Redirect temporaneo; il browser può trasformare la richiesta in GET.',
    'Temporary redirect; the browser may turn the request into a GET.',
  ],
  303: [
    'See Other',
    'Vai a un’altra risorsa con GET, tipico dopo un POST.',
    'Fetch another resource with GET, typical after a POST.',
  ],
  304: [
    'Not Modified',
    'La copia in cache è ancora valida: nessun corpo inviato.',
    'The cached copy is still valid: no body sent.',
  ],
  307: [
    'Temporary Redirect',
    'Redirect temporaneo che mantiene metodo e corpo.',
    'Temporary redirect that keeps the method and body.',
  ],
  308: [
    'Permanent Redirect',
    'Redirect permanente che mantiene metodo e corpo.',
    'Permanent redirect that keeps the method and body.',
  ],
  400: [
    'Bad Request',
    'Richiesta malformata: sintassi, parametri o corpo non validi.',
    'Malformed request: invalid syntax, parameters or body.',
  ],
  401: [
    'Unauthorized',
    'Serve l’autenticazione: credenziali mancanti o non valide.',
    'Authentication needed: credentials missing or invalid.',
  ],
  402: ['Payment Required', 'Riservato per i pagamenti, poco usato.', 'Reserved for payments, rarely used.'],
  403: [
    'Forbidden',
    'Il server ha capito chi sei, ma non hai il permesso per questa risorsa.',
    'The server knows who you are, but you may not access this resource.',
  ],
  404: [
    'Not Found',
    'La risorsa non esiste, o il server non vuole dirlo.',
    'The resource does not exist, or the server will not say.',
  ],
  405: [
    'Method Not Allowed',
    'Metodo HTTP non supportato qui; l’header Allow elenca quelli validi.',
    'HTTP method not supported here; the Allow header lists the valid ones.',
  ],
  406: [
    'Not Acceptable',
    'Nessun formato disponibile corrisponde agli header Accept.',
    'No available format matches the Accept headers.',
  ],
  407: [
    'Proxy Authentication Required',
    'Bisogna autenticarsi al proxy.',
    'You must authenticate with the proxy.',
  ],
  408: [
    'Request Timeout',
    'Il client ha impiegato troppo a inviare la richiesta.',
    'The client took too long to send the request.',
  ],
  409: [
    'Conflict',
    'In conflitto con lo stato attuale della risorsa, per esempio una modifica concorrente.',
    'Conflicts with the current state of the resource, e.g. a concurrent edit.',
  ],
  410: ['Gone', 'Rimossa per sempre, senza un nuovo indirizzo.', 'Removed for good, with no new address.'],
  411: ['Length Required', 'Manca l’header Content-Length.', 'The Content-Length header is missing.'],
  412: [
    'Precondition Failed',
    'Una condizione negli header, come If-Match, non è soddisfatta.',
    'A condition in the headers, such as If-Match, is not met.',
  ],
  413: ['Content Too Large', 'Il corpo della richiesta è troppo grande.', 'The request body is too large.'],
  414: ['URI Too Long', 'L’URL è troppo lungo per il server.', 'The URL is too long for the server.'],
  415: [
    'Unsupported Media Type',
    'Formato del corpo non supportato: controlla Content-Type.',
    'Body format not supported: check Content-Type.',
  ],
  416: [
    'Range Not Satisfiable',
    'L’intervallo chiesto con Range è fuori dalla risorsa.',
    'The range asked with Range is outside the resource.',
  ],
  418: [
    'I’m a teapot',
    'La teiera che si rifiuta di fare il caffè: pesce d’aprile del 1998 (RFC 2324).',
    'A teapot refusing to brew coffee: an April Fools’ joke from 1998 (RFC 2324).',
  ],
  422: [
    'Unprocessable Content',
    'Sintassi corretta ma dati non validi: errori di validazione.',
    'Well-formed but invalid data: validation errors.',
  ],
  423: ['Locked', 'La risorsa è bloccata (WebDAV).', 'The resource is locked (WebDAV).'],
  425: [
    'Too Early',
    'Il server non rischia di elaborare una richiesta che potrebbe essere ripetuta.',
    'The server will not risk processing a request that might be replayed.',
  ],
  426: [
    'Upgrade Required',
    'Serve un altro protocollo, indicato nell’header Upgrade.',
    'Another protocol is needed, named in the Upgrade header.',
  ],
  428: [
    'Precondition Required',
    'Il server vuole una richiesta condizionale, con If-Match o simili.',
    'The server wants a conditional request, with If-Match or similar.',
  ],
  429: [
    'Too Many Requests',
    'Troppe richieste: aspetta (vedi Retry-After) e riprova.',
    'Too many requests: wait (see Retry-After) and try again.',
  ],
  431: [
    'Request Header Fields Too Large',
    'Header troppo grandi, spesso per troppi cookie.',
    'Headers too large, often because of too many cookies.',
  ],
  451: [
    'Unavailable For Legal Reasons',
    'Non disponibile per motivi legali.',
    'Unavailable for legal reasons.',
  ],
  500: [
    'Internal Server Error',
    'Errore generico del server: guarda i log.',
    'Generic server error: check the logs.',
  ],
  501: [
    'Not Implemented',
    'Il server non supporta la funzionalità richiesta.',
    'The server does not support the requested feature.',
  ],
  502: [
    'Bad Gateway',
    'Il proxy o gateway ha ricevuto una risposta non valida dal server a monte.',
    'The proxy or gateway got an invalid response from the upstream server.',
  ],
  503: [
    'Service Unavailable',
    'Servizio non disponibile per ora: sovraccarico o in manutenzione.',
    'Not available right now: overloaded or under maintenance.',
  ],
  504: [
    'Gateway Timeout',
    'Il proxy o gateway non ha avuto risposta in tempo dal server a monte.',
    'The proxy or gateway got no response from the upstream server in time.',
  ],
  505: ['HTTP Version Not Supported', 'Versione di HTTP non supportata.', 'HTTP version not supported.'],
  507: [
    'Insufficient Storage',
    'Il server non ha spazio per completare la richiesta (WebDAV).',
    'The server has no room to complete the request (WebDAV).',
  ],
  508: [
    'Loop Detected',
    'Ciclo infinito rilevato durante l’elaborazione (WebDAV).',
    'Infinite loop detected while processing (WebDAV).',
  ],
  511: [
    'Network Authentication Required',
    'Bisogna accedere alla rete, per esempio dal portale di un Wi-Fi.',
    'You must log in to the network, e.g. a Wi-Fi captive portal.',
  ],
};
