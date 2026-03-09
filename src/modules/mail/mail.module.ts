import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigType } from '@nestjs/config';
import { join } from 'path';
import { readFileSync, readdirSync } from 'fs';
import * as Handlebars from 'handlebars';
import { MailService } from './mail.service';
import mailConfig from '../../config/mail.config';

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
      inject: [mailConfig.KEY],
      useFactory: (mailConf: ConfigType<typeof mailConfig>) => ({
        transport: {
          host: mailConf.host,
          port: mailConf.port,
          secure: false,
          auth: {
            user: mailConf.user,
            pass: mailConf.password,
          },
        },
        defaults: {
          from: mailConf.from,
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
