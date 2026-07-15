import { jest } from '@jest/globals'
import P from 'pino'
import { LIDMappingStore } from '../../Signal/lid-mapping'
import type { LIDMapping, SignalDataTypeMap, SignalKeyStoreWithTransaction } from '../../Types'

const HOSTED_DEVICE_ID = 99

const mockKeys: jest.Mocked<SignalKeyStoreWithTransaction> = {
	get: jest.fn<SignalKeyStoreWithTransaction['get']>() as any,
	set: jest.fn<SignalKeyStoreWithTransaction['set']>(),
	transaction: jest.fn<SignalKeyStoreWithTransaction['transaction']>(async (work: () => any) => await work()) as any,
	isInTransaction: jest.fn<SignalKeyStoreWithTransaction['isInTransaction']>()
}
const mockLidMappingGet = mockKeys.get as unknown as jest.MockedFunction<
	(type: 'lid-mapping', ids: string[]) => Promise<Record<string, string>>
>
const logger = P({ level: 'silent' })

describe('LIDMappingStore', () => {
	const mockPnToLIDFunc = jest.fn<(jids: string[]) => Promise<LIDMapping[] | undefined>>()
	let lidMappingStore: LIDMappingStore

	beforeEach(() => {
		jest.clearAllMocks()
		lidMappingStore = new LIDMappingStore(mockKeys, logger, mockPnToLIDFunc)
	})

	describe('getPNForLID', () => {
		it('should correctly map a standard LID with a hosted device ID back to a standard PN with a hosted device', async () => {
			const lidWithHostedDevice = `12345:${HOSTED_DEVICE_ID}@lid`
			const pnUser = '54321'

			// @ts-ignore
			mockKeys.get.mockResolvedValue({ [`12345_reverse`]: pnUser } as SignalDataTypeMap['lid-mapping'])

			const result = await lidMappingStore.getPNForLID(lidWithHostedDevice)
			expect(result).toBe(`${pnUser}:${HOSTED_DEVICE_ID}@s.whatsapp.net`)
		})

		it('should return null if no reverse mapping is found', async () => {
			const lid = 'nonexistent@lid'

			// @ts-ignore
			mockKeys.get.mockResolvedValue({} as SignalDataTypeMap['lid-mapping']) // Simulate not found in DB

			const result = await lidMappingStore.getPNForLID(lid)
			expect(result).toBeNull()
		})
	})

	describe('local-only mapping reads', () => {
		it('reads a stored PN-to-LID mapping without calling USync', async () => {
			mockLidMappingGet.mockResolvedValue({ '5511999999999': '123456789012345' })

			const result = await lidMappingStore.getStoredLIDForPN('5511999999999:2@s.whatsapp.net')

			expect(result).toBe('123456789012345:2@lid')
			expect(mockPnToLIDFunc).not.toHaveBeenCalled()
		})

		it('returns null on a local miss without calling USync', async () => {
			mockLidMappingGet.mockResolvedValue({})

			const result = await lidMappingStore.getStoredLIDForPN('5511999999999@s.whatsapp.net')

			expect(result).toBeNull()
			expect(mockPnToLIDFunc).not.toHaveBeenCalled()
		})

		it('rejects a bare PN so callers must use an explicit JID API', async () => {
			const result = await lidMappingStore.getStoredLIDForPN('5511999999999')

			expect(result).toBeNull()
			expect(mockKeys.get).not.toHaveBeenCalled()
			expect(mockPnToLIDFunc).not.toHaveBeenCalled()
		})

		it('exposes the reverse read under an explicit local-only name', async () => {
			mockLidMappingGet.mockResolvedValue({ '123456789012345_reverse': '5511999999999' })

			const result = await lidMappingStore.getStoredPNForLID('123456789012345:2@lid')

			expect(result).toBe('5511999999999:2@s.whatsapp.net')
			expect(mockPnToLIDFunc).not.toHaveBeenCalled()
		})
	})
})
