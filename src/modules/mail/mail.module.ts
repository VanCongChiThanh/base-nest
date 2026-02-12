import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { readFileSync, readdirSync } from 'fs';
import * as Handlebars from 'handlebars';
import { MailService } from './mail.service';

// Register all partials from the partials directory
const PARTIALS_DIR = join(__dirname, 'templates', 'partials');
try {
  const partialFiles = readdirSync(PARTIALS_DIR).filter((f) =>
    f.endsWith('.hbs'),
  );
  partialFiles.forEach((file) => {
    const partialName = file.replace('.hbs', '');
    const partialContent = readFileSync(join(PARTIALS_DIR, file), 'utf8');
    Handlebars.registerPartial(partialName, partialContent);
  });
} catch {
  // Partials directory may not exist in test environment
}

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('mail.host'),
          port: configService.get<number>('mail.port'),
          secure: false,
          auth: {
            user: configService.get<string>('mail.user'),
            pass: configService.get<string>('mail.password'),
          },
        },
        defaults: {
          from: configService.get<string>('mail.from'),
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
