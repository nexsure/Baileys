import type { ILogger } from '../Utils/logger'
import {
	isHostedLidUser,
	isHostedPnUser,
	isLidUser,
	isPnUser,
	jidDecode,
	jidNormalizedUser
} from '../WABinary/jid-utils'
import type { BinaryNodeAttributes } from '../WABinary/types'

export type MessageSendJid = {
	jid: string
	remoteJidAlt?: string
	addressingMode?: 'lid'
	additionalAttributes?: BinaryNodeAttributes
}

export const resolveMessageSendJid = async (
	jid: string,
	getStoredLIDForPN: (pn: string) => Promise<string | null>,
	logger?: ILogger
): Promise<MessageSendJid> => {
	if (!isPnUser(jid) && !isHostedPnUser(jid)) return { jid }

	let lid: string | null
	try {
		lid = await getStoredLIDForPN(jid)
	} catch (error) {
		logger?.debug({ error, jidServer: jidDecode(jid)?.server }, 'failed to resolve stored LID for PN send')
		return { jid }
	}

	if (!lid || (!isLidUser(lid) && !isHostedLidUser(lid))) return { jid }

	const remoteJidAlt = jidNormalizedUser(jid)
	return {
		jid: lid,
		remoteJidAlt,
		addressingMode: 'lid',
		additionalAttributes: {
			addressing_mode: 'lid',
			recipient_pn: remoteJidAlt
		}
	}
}
