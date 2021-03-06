const logtopus = require('../logtopus').getLogger('test', {
  logger: {
    console: {
      colors: true,
      template: 'minimal',
      timestamp: true,
      uptime: true
    }
  }
})

logtopus.setLevel('info')
logtopus.info('Hello Logtopus!')
logtopus.info('This is the default log with uptime and timestamp')
logtopus.req('API request', '/api/v1/ping')
logtopus.res('API response', { status: 204 })
logtopus.error('Error log')
logtopus.error('Something went wrong', new Error('Internet not found'))
