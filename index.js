// dependencies
var async = require("async")
var AWS = require("aws-sdk")
var fs = require("fs")
var exec = require("child_process").exec
const { PDFDocument } = require("pdf-lib")

var s3 = new AWS.S3()
var resolution = 150 // 150,300,600,
exports.handler = function (event, context) {
  const srcBucket = event.Records[0].s3.bucket.name
  const srcKey = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  )
  const dstBucket = srcBucket + "-resized"
  const thumbnailBucket = srcBucket + "-thumbnail"
  const dstKey = "resized-" + srcKey
  if (srcBucket == dstBucket) {
    console.error("Destination bucket must not match source bucket.")
    return
  }

  // Infer the image type.
  var typeMatch = srcKey.match(/\.([^.]*)$/)
  if (!typeMatch) {
    console.error("unable to infer image type for key " + srcKey)
    return
  }
  var imageType = typeMatch[1]
  console.log("imageType: " + imageType)
  if (imageType != "pdf") {
    // console.log('skipping non-image ' + srcKey);
    // return;
  }

  async.waterfall(
    [
      function download(next) {
        console.log("download start ")
        s3.getObject(
          {
            Bucket: srcBucket,
            Key: srcKey,
          },
          async function (err, data) {
            const pdfDoc = await PDFDocument.load(data.Body)
            const subDocument = await PDFDocument.create()
            const [copiedPage] = await subDocument.copyPages(pdfDoc, [0])
            subDocument.addPage(copiedPage)
            const pdfBytes = await subDocument.save()

            const splitFile = srcKey.split(".pdf")[0] + ".pdf"

            await s3
              .putObject({
                Bucket: thumbnailBucket,
                Key: splitFile,
                Body: pdfBytes,
                ContentType: data.ContentType,
              })
              .promise()
            console.log("PDF file split and saved to S3 successfully.")

            fs.writeFile(
              "/tmp/a.pdf",
              data.Body,
              {
                encoding: null,
              },
              function (fserr) {
                console.log("fserr: " + fserr)
                if (fserr) {
                  // if there is problem just print to console and
                  // move on.
                } else {
                  console.log("File Downloaded! " + data.ContentType)
                  next(fserr, data.ContentType)
                }
              }
            )
          }
        )
      },
      function compress(contentType, next) {
        console.log("compress start  contentType: " + contentType)

        exec(
          "gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen -dNOPAUSE -dQUIET -dBATCH -sOutputFile=/tmp/b.pdf /tmp/a.pdf",
          function (error, stdout, stderr) {
            console.log("stdout: " + stdout)
            console.log("stderr: " + stderr)
            if (error !== null) {
              console.log("exec error: " + error)
            } else {
              next(null, contentType)
            }
          }
        )
      },
      function upload(contentType) {
        console.log("upload start  contentType: " + contentType)

        s3.putObject(
          {
            Bucket: dstBucket,
            Key: dstKey,
            Body: fs.createReadStream("/tmp/b.pdf"),
            ContentType: contentType,
          },
          function (error, data) {
            console.log("pdf ends+error" + error)
            context.done()
          }
        )
      },
    ],
    function (e, r) {
      if (e) throw e
    }
  )

  console.log("done")
  // context.done();
}
