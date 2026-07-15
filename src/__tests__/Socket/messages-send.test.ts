import { jest } from '@jest/globals'
import { resolveMessageSendJid, selectMessageSendJid } from '../../Socket/message-send-jid'

describe('resolveMessageSendJid', () => {
	it('routes a warm PN to its locally mapped LID with alternate PN stanza metadata', async () => {
		const getStoredLIDForPN = jest.fn(async (): Promise<string | null> => '98765@lid')

		const result = await resolveMessageSendJid('12345@s.whatsapp.net', getStoredLIDForPN)

		expect(result).toEqual({
			jid: '98765@lid',
			remoteJidAlt: '12345@s.whatsapp.net',
			addressingMode: 'lid',
			additionalAttributes: {
				addressing_mode: 'lid',
				recipient_pn: '12345@s.whatsapp.net'
			}
		})
		expect(getStoredLIDForPN).toHaveBeenCalledWith('12345@s.whatsapp.net')
	})

	it('keeps the cold PN path when no trusted local mapping exists', async () => {
		const getStoredLIDForPN = jest.fn(async (): Promise<string | null> => null)

		await expect(resolveMessageSendJid('12345@s.whatsapp.net', getStoredLIDForPN)).resolves.toEqual({
			jid: '12345@s.whatsapp.net'
		})
	})

	it('keeps the PN path when the local store fails', async () => {
		const getStoredLIDForPN = jest.fn(async (): Promise<string | null> => {
			throw new Error('key store unavailable')
		})

		await expect(resolveMessageSendJid('12345@s.whatsapp.net', getStoredLIDForPN)).resolves.toEqual({
			jid: '12345@s.whatsapp.net'
		})
	})

	it('preserves hosted addressing and device qualification', async () => {
		const getStoredLIDForPN = jest.fn(async (): Promise<string | null> => '98765:7@hosted.lid')

		const result = await resolveMessageSendJid('12345:7@hosted', getStoredLIDForPN)

		expect(result).toMatchObject({
			jid: '98765:7@hosted.lid',
			remoteJidAlt: '12345@hosted',
			addressingMode: 'lid'
		})
	})

	it('does not resolve a LID or group destination again', async () => {
		const getStoredLIDForPN = jest.fn(async (): Promise<string | null> => {
			throw new Error('unexpected lookup')
		})

		await expect(resolveMessageSendJid('98765@lid', getStoredLIDForPN)).resolves.toEqual({ jid: '98765@lid' })
		await expect(resolveMessageSendJid('12345@g.us', getStoredLIDForPN)).resolves.toEqual({ jid: '12345@g.us' })
		expect(getStoredLIDForPN).not.toHaveBeenCalled()
	})

	it('rejects a non-LID local value and falls back to PN', async () => {
		const getStoredLIDForPN = jest.fn(async (): Promise<string | null> => '98765@s.whatsapp.net')

		await expect(resolveMessageSendJid('12345@s.whatsapp.net', getStoredLIDForPN)).resolves.toEqual({
			jid: '12345@s.whatsapp.net'
		})
	})

	it('returns to the exact PN stanza after the active mapping is invalidated', async () => {
		let storedLid: string | null = '98765@lid'
		const getStoredLIDForPN = jest.fn(async (): Promise<string | null> => storedLid)

		await expect(resolveMessageSendJid('12345@s.whatsapp.net', getStoredLIDForPN)).resolves.toEqual({
			jid: '98765@lid',
			remoteJidAlt: '12345@s.whatsapp.net',
			addressingMode: 'lid',
			additionalAttributes: {
				addressing_mode: 'lid',
				recipient_pn: '12345@s.whatsapp.net'
			}
		})

		storedLid = null
		await expect(resolveMessageSendJid('12345@s.whatsapp.net', getStoredLIDForPN)).resolves.toEqual({
			jid: '12345@s.whatsapp.net'
		})
	})

	it('keeps retry stanza/session addressing deterministic while the mapping remains trusted', async () => {
		const getStoredLIDForPN = jest.fn(async (): Promise<string | null> => '98765@lid')

		const first = await resolveMessageSendJid('12345@s.whatsapp.net', getStoredLIDForPN)
		const retry = await resolveMessageSendJid('12345@s.whatsapp.net', getStoredLIDForPN)

		expect(retry).toEqual(first)
		expect(getStoredLIDForPN).toHaveBeenCalledTimes(2)
	})

	it('bypasses the mapping store and emits the exact PN stanza when the feature is disabled', async () => {
		const getStoredLIDForPN = jest.fn(async (): Promise<string | null> => '98765@lid')

		await expect(selectMessageSendJid('12345@s.whatsapp.net', false, getStoredLIDForPN)).resolves.toEqual({
			jid: '12345@s.whatsapp.net'
		})
		expect(getStoredLIDForPN).not.toHaveBeenCalled()
	})
})
