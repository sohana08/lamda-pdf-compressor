# lamda-pdf-compressor

### Packages To Install
  - fs
  - child_process
  - pdf-lib
  
### Process

* fs will be used to process the file
* child process will be used to exec ghostscript inside our function
* pdf-lib will be used tp extract first page of the pdf file

### Lamda Function
* Zip the file and upload in the lambda function. To run the lambda function on s3, Do install ghostscript layer inside lambda.
- ARN FOR GHOSTSCRIPT: 'arn:aws:lambda:ap-southeast-1:764866452798:layer:ghostscript:13'

