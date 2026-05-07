import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const headers = request.headers
    const clientIP = headers.get('x-forwarded-for') || 
                    headers.get('x-real-ip') || 
                    'unknown'
    
    const timestamp = new Date().toISOString()
    
    return NextResponse.json({
      success: true,
      message: "Connection test successful",
      server_info: {
        timestamp,
        client_ip: clientIP,
        method: "GET",
        endpoint: "/api/test/connection"
      },
      next_steps: {
        message: "If you can see this, basic connectivity works. Now test POST with authentication."
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const headers = request.headers
    const clientIP = headers.get('x-forwarded-for') || 
                    headers.get('x-real-ip') || 
                    'unknown'
    
    const body = await request.text()
    const timestamp = new Date().toISOString()
    
    // Check for authentication header
    const authHeader = headers.get('authorization')
    const hasAuth = authHeader ? true : false
    
    return NextResponse.json({
      success: true,
      message: "POST connection test successful",
      server_info: {
        timestamp,
        client_ip: clientIP,
        method: "POST",
        endpoint: "/api/test/connection",
        has_authentication: hasAuth,
        body_length: body.length
      },
      authentication_test: {
        has_bearer_token: authHeader?.startsWith('Bearer ') || false,
        recommendation: hasAuth ? 
          "Authentication header detected. Ready for webhook testing." : 
          "Add Authorization header for full webhook testing."
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
