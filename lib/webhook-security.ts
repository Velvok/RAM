import { createHmac } from 'crypto'

export interface WebhookSecurityConfig {
  secret: string
  enableHmac?: boolean
  enableBearerToken?: boolean
}

export class WebhookSecurity {
  private config: WebhookSecurityConfig

  constructor(config: WebhookSecurityConfig) {
    this.config = {
      enableHmac: true,
      enableBearerToken: true,
      ...config
    }
  }

  /**
   * Verifica la autenticación del webhook
   */
  async verifyWebhook(
    headers: Headers,
    body: string
  ): Promise<{ valid: boolean; error?: string }> {
    const errors: string[] = []

    // 1. Verificar Bearer Token
    if (this.config.enableBearerToken) {
      const bearerResult = this.verifyBearerToken(headers)
      if (!bearerResult.valid) {
        errors.push(bearerResult.error || 'Invalid bearer token')
      }
    }

    // 2. Verificar firma HMAC
    if (this.config.enableHmac) {
      const hmacResult = this.verifyHmacSignature(headers, body)
      if (!hmacResult.valid) {
        errors.push(hmacResult.error || 'Invalid HMAC signature')
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join('; ')
      }
    }

    return { valid: true }
  }

  /**
   * Verifica el Bearer Token en header Authorization
   */
  private verifyBearerToken(headers: Headers): { valid: boolean; error?: string } {
    const authHeader = headers.get('authorization')
    
    if (!authHeader) {
      return { valid: false, error: 'Missing Authorization header' }
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { valid: false, error: 'Invalid Authorization format. Must be "Bearer <token>"' }
    }

    const token = authHeader.substring(7) // Remove "Bearer "
    
    if (token !== this.config.secret) {
      return { valid: false, error: 'Invalid bearer token' }
    }

    return { valid: true }
  }

  /**
   * Verifica la firma HMAC SHA256
   */
  private verifyHmacSignature(headers: Headers, body: string): { valid: boolean; error?: string } {
    const signature = headers.get('x-evo-signature')
    const timestamp = headers.get('x-evo-timestamp')
    
    if (!signature) {
      return { valid: false, error: 'Missing x-evo-signature header' }
    }

    if (!timestamp) {
      return { valid: false, error: 'Missing x-evo-timestamp header' }
    }

    // Verificar que el timestamp no sea muy antiguo (5 minutos)
    const now = Math.floor(Date.now() / 1000)
    const requestTime = parseInt(timestamp)
    
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 300) {
      return { valid: false, error: 'Request timestamp too old' }
    }

    // Calcular firma esperada
    const expectedSignature = this.generateHmacSignature(body, timestamp)
    
    // Usar timing-safe comparison
    if (!this.safeCompare(signature, expectedSignature)) {
      return { valid: false, error: 'Invalid HMAC signature' }
    }

    return { valid: true }
  }

  /**
   * Genera firma HMAC SHA256
   */
  generateHmacSignature(body: string, timestamp: string): string {
    const hmac = createHmac('sha256', this.config.secret)
    const payload = `${body}.${timestamp}`
    hmac.update(payload)
    return hmac.digest('hex')
  }

  /**
   * Comparación segura de strings para prevenir timing attacks
   */
  private safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Genera headers para pruebas
   */
  generateTestHeaders(body: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = this.generateHmacSignature(body, timestamp)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-evo-timestamp': timestamp
    }

    if (this.config.enableBearerToken) {
      headers['authorization'] = `Bearer ${this.config.secret}`
    }

    if (this.config.enableHmac) {
      headers['x-evo-signature'] = signature
    }

    return headers
  }
}

/**
 * Middleware para verificar webhooks
 */
export function createWebhookVerifier(config: WebhookSecurityConfig) {
  const security = new WebhookSecurity(config)

  return async function verifyWebhook(
    headers: Headers,
    body: string
  ): Promise<{ valid: boolean; error?: string }> {
    return await security.verifyWebhook(headers, body)
  }
}
