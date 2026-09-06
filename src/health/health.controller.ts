import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller({ path: 'health', version: 'neutral' })
export class HealthController {
  @Get()
  check() {
    return { service: 'stonelab-server', status: 'ok', timestamp: new Date().toISOString() };
  }
}
