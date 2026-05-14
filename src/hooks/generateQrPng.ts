import type { CollectionAfterChangeHook } from 'payload'
import QRCode from 'qrcode'

export const generateQrPng: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
  previousDoc,
}) => {
  const targetChanged =
    !previousDoc
    || previousDoc.targetUrl !== doc.targetUrl
    || previousDoc.fgColor !== doc.fgColor
    || previousDoc.bgColor !== doc.bgColor

  if (operation === 'update' && !targetChanged) return doc
  if (!doc.targetUrl) return doc

  const buffer = await QRCode.toBuffer(doc.targetUrl, {
    type: 'png',
    color: {
      dark: doc.fgColor || '#000000',
      light: doc.bgColor || '#FFFFFF',
    },
    width: 512,
    margin: 2,
  })

  const filename = `qr-${doc.id}.png`
  const tenantId =
    typeof doc.tenant === 'object' && doc.tenant !== null && 'id' in doc.tenant
      ? (doc.tenant as { id: string | number }).id
      : doc.tenant

  if (doc.generatedImage) {
    const mediaId =
      typeof doc.generatedImage === 'object' && doc.generatedImage !== null && 'id' in doc.generatedImage
        ? (doc.generatedImage as { id: string | number }).id
        : doc.generatedImage
    await req.payload.update({
      collection: 'media',
      id: mediaId as string | number,
      data: { alt: doc.label || filename },
      file: {
        data: buffer,
        mimetype: 'image/png',
        name: filename,
        size: buffer.length,
      },
    })
    return doc
  }

  const media = await req.payload.create({
    collection: 'media',
    data: { alt: doc.label || filename, tenant: tenantId },
    file: {
      data: buffer,
      mimetype: 'image/png',
      name: filename,
      size: buffer.length,
    },
  })

  await req.payload.update({
    collection: 'qr-codes',
    id: doc.id,
    data: { generatedImage: media.id },
  })

  return { ...doc, generatedImage: media.id }
}
