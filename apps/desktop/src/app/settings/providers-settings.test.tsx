import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ProvidersSettings } from './providers-settings'
const calls = vi.hoisted(() => ({
  endpoints: vi.fn(async () => ({ endpoints: [] })),
  oauth: vi.fn(),
  save: vi.fn(async () => ({ endpoints: [], id: 'custom' }))
}))
vi.mock('@/hermes', () => ({
  getCustomEndpoints: calls.endpoints,
  listOAuthProviders: calls.oauth,
  activateCustomEndpoint: vi.fn(),
  deleteCustomEndpoint: vi.fn(),
  saveCustomEndpoint: calls.save,
  validateCustomEndpoint: vi.fn()
}))
afterEach(cleanup)
test('provider settings offers only custom endpoints with Chinese labels and no account discovery', async () => {
  render(<ProvidersSettings onClose={() => {}} onViewChange={() => {}} view="custom-endpoints" />)
  expect(await screen.findByText('自定义端点')).toBeTruthy()
  expect(screen.getByText('端点 URL')).toBeTruthy()
  expect(screen.queryByText(/Nous Portal|OpenRouter|Fireworks|账单/)).toBeNull()
  expect(calls.endpoints).toHaveBeenCalled()
  expect(calls.oauth).not.toHaveBeenCalled()
})

test('custom endpoint form still saves the URL, model and key through the existing server API', async () => {
  render(<ProvidersSettings onClose={() => {}} onViewChange={() => {}} view="custom-endpoints" />)
  await screen.findByText('自定义端点')
  fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'My API' } })
  fireEvent.change(screen.getByLabelText('端点 URL'), { target: { value: 'https://api.example.com/v1' } })
  fireEvent.change(screen.getByLabelText('默认模型'), { target: { value: 'my-model' } })
  fireEvent.change(screen.getByLabelText('API 密钥'), { target: { value: 'test-key' } })
  fireEvent.click(screen.getByRole('button', { name: '保存' }))
  await waitFor(() =>
    expect(calls.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My API',
        base_url: 'https://api.example.com/v1',
        model: 'my-model',
        api_key: 'test-key',
        make_default: true
      })
    )
  )
})
