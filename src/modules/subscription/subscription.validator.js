import { z } from 'zod';

export const choosePackageSchema = z.object({
  body: z.object({
    packageId: z.string({ required_error: 'Package selection is required.' })
      .min(1, 'Package ID is required.')
  }).passthrough()
});

export const upgradeSubscriptionSchema = z.object({
  body: z.object({
    packageId: z.string({ required_error: 'Package selection is required.' })
      .min(1, 'Package ID is required.')
  }).passthrough()
});
