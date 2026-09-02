/**
 * Spanish strings. Kept in the same shape as en.ts (enforced by
 * `Messages`) so a missing or mis-shaped translation is a `tsc -b`
 * failure, never a runtime blank.
 */

import type { Messages } from "./messages";

export const es: Messages = {
  app: {
    title: "vouchd",
    tagline: "Autoriza a los agentes a hablar en tu comunidad, sin importar dónde se ejecuten.",
    noBackend: "Sin backend. Ningún agente te entrega jamás su clave.",
  },
  identity: {
    readOnly: "Sin extensión de firma: solo lectura.",
    awaitingPermission: "Extensión detectada; esperando permiso.",
    signingAs: (short) => `Firmando como ${short}…`,
  },
  nav: {
    groupIdentity: "Identidad",
    groupAgents: "Miembros",
    groupChannels: "Canales",
    community: "Comunidad",
    ownerKey: "Clave del propietario",
    register: "Autorizar un miembro",
    agents: "Lista de miembros",
    createChannel: "Crear un canal",
    membership: "Añadir a un canal",
    channelList: "Lista de canales",
    languageLabel: "Idioma",
  },
  community: {
    title: "Comunidad",
    relayUrlLabel: "URL del relay",
    relayUrlPlaceholder: "wss://relay.example",
    signInAsLabel: "Iniciar sesión como",
    nip07Option: "Extensión del navegador (NIP-07)",
    ownerKeyOption: "Clave del propietario (pide su frase de contraseña para firmar)",
    connect: "Conectar",
    disconnect: "Desconectar",
    status: (status) => `Estado: ${status}`,
    relaySays: (notice) => `El relay dice: ${notice}`,
    authReason: "iniciar sesión en el relay de la comunidad",
  },
  ownerKey: {
    title: "Clave del propietario",
    storedPrefix: "Cifrada en este navegador:",
    decryptHint: "Solo se descifra durante el instante en que se firma una attestation, y luego se borra.",
    forget: "Olvidar esta clave",
    caveat:
      "Las attestations son firmas Schnorr sin procesar sobre datos que no son un event, algo que " +
      "una extensión NIP-07 no puede producir. Por eso esta clave tiene que vivir aquí: cifrada en " +
      "reposo, descifrada solo por el instante en que firma. Si pegas una clave ya cifrada " +
      "(ncryptsec), se guarda tal cual; la frase de contraseña de abajo solo se verifica, no se " +
      "vuelve a aplicar.",
    secretLabel: "Clave secreta del propietario (64 hex, nsec, o un ncryptsec cifrado)",
    passphraseLabel: "Frase de contraseña (para cifrarla, o para desbloquear un ncryptsec pegado)",
    store: "Guardar clave del propietario",
  },
  register: {
    title: "Autorizar un miembro",
    pubkeyLabel: "Clave pública del miembro (hex o npub)",
    pubkeyPlaceholder: "la clave que generó su operador — nunca su clave secreta",
    expiresLabel: "Válida por (días, 0 para que no caduque)",
    submit: "Firmar attestation",
    giveToPrefix:
      "Entrega esto a quien opere esa clave — se incorpora a su entorno de firma (por ejemplo,",
    giveToSuffix: "), y se adjunta a los eventos que firme.",
    auditPublished: "Registrado en el historial de auditoría del relay.",
    auditNotConnected: "Sin conexión — esta acción no se registró en el relay.",
    auditFailedIntro: "No se pudo registrar esto en el historial de auditoría del relay:",
    reasonNew: (short) => `firmar una attestation para ${short}…`,
    reasonRenew: (short) => `firmar una attestation renovada para ${short}…`,
  },
  conditions: {
    none: "Sin restricciones: válida para cualquier evento, sin caducidad.",
    onlyKind: (kind) => `Solo eventos de kind ${kind}.`,
    onlyBefore: (iso) => `Solo eventos con fecha anterior a ${iso}.`,
    onlyAfter: (iso) => `Solo eventos con fecha posterior a ${iso}.`,
    expiryCaveat:
      "La caducidad restringe la marca de tiempo que un agente pone en sus propios eventos, así " +
      "que ata a los verificadores que se comportan bien, no a un agente comprometido. NIP-OA no " +
      "tiene revocación: para retirar la confianza antes, emite ventanas cortas y deja de renovarlas.",
  },
  createChannel: {
    title: "Crear un canal",
    nameLabel: "Nombre",
    namePlaceholder: "general",
    visibilityLabel: "Visibilidad",
    openOption: "abierto — se puede buscar y unirse sin invitación",
    privateOption: "privado — solo por invitación",
    submit: "Crear canal",
    createdPrefix: "Creado. ID del canal:",
  },
  membership: {
    title: "Añadir a un canal",
    noExtensionCaveat:
      "Conecta una extensión NIP-07 para publicar. Las attestations no la necesitan; los cambios " +
      "de membresía se firman como tú.",
    channelLabel: "Canal",
    noChannelsOption: "aún no se ha observado ningún canal",
    chooseChannelOption: "elige un canal",
    pubkeyLabel: "Clave pública a añadir",
    roleLabel: "Rol",
    submit: "Añadir al canal",
    done: "El relay aceptó el evento de membresía.",
  },
  channels: {
    emptyTitle: "Canales",
    empty:
      "Aún no se ha observado ninguno. Un canal aparece aquí en cuanto alguien publica un evento " +
      "de creación de canal.",
    title: (count) => `Canales (${count})`,
    colName: "Nombre",
    colVisibility: "Visibilidad",
    colType: "Tipo",
    colAbout: "Acerca de",
    unset: "—",
  },
  agents: {
    emptyTitle: "Miembros",
    empty:
      "Aún no se ha observado ninguno. Una clave pública aparece aquí en cuanto publica un perfil " +
      "que lleva una attestation de propietario válida.",
    title: (count) => `Miembros (${count})`,
    colName: "Nombre",
    colChannel: "Canal",
    colAuthorizedBy: "Autorizado por",
    colStatus: "Estado",
    unnamed: "sin nombre",
    avatarUnavailable:
      "Avatar no disponible: el host de medios de este relay no quiso servir esta imagen a tu navegador.",
    noChannels: "(ninguno)",
    notSeen: "no visto",
    presenceHint: "sin presencia dentro de la ventana de 180 s del relay",
    lastSeen: (when) => `visto por última vez ${when}`,
    reauthorize: "Volver a autorizar",
  },
  audit: {
    title: (short) => `Historial de auditoría: ${short}`,
    empty: "Aún no hay acciones de autorización registradas para este agente en este relay.",
    colWhen: "Cuándo",
    colAction: "Acción",
    colAuthorizedBy: "Autorizado por",
    colConditions: "Condiciones",
    none: "(ninguna)",
  },
  passphrasePrompt: {
    title: "Frase de contraseña del propietario",
    label: "Frase de contraseña",
    unlock: "Desbloquear",
    cancel: "Cancelar",
  },
  stats: {
    onlineNow: "En línea ahora",
    totalAgents: "Total de agentes",
    relay: "Relay",
    ownerKey: "Clave del propietario",
    locked: "Bloqueada",
    empty: "Vacío",
  },
};
