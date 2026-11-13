import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './StaticPage.css';

export default function TermsOfService() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="static-page">
      <div className="static-page__container">
        <Link className="static-page__back" to="/">
          ← Back
        </Link>

        <h1 className="static-page__title">Terms of Service</h1>
        <p className="static-page__last-updated">
          Effective Date: TBD &nbsp;|&nbsp; Last Revision Date: TBD
        </p>

        <p>
          Your use of the websites, mobile sites, and subdomains on which these terms reside
          (collectively, the "Tool"), and the features at this Tool are subject to these Terms of
          Service, which we may update from time to time.
        </p>
        <p>
          Please read these Terms of Service carefully before using this Tool. The terms are
          legally binding for your use of the Tool.
        </p>

        <h2>Introduction and Overview</h2>
        <p>
          Action for Children owns or controls the Tool. This Tool is intended for and applicable
          only for residents of the United States. By accessing this Tool in any way, including,
          without limitation, browsing this Tool, using any information, and/or submitting
          information to Action for Children, you agree to and are bound by the terms, conditions,
          policies, and notices contained on this page (the "Terms"), including, but not limited
          to, conducting this transaction electronically, disclaimers of warranties, damage and
          remedy exclusions and limitations, and a choice of Ohio law.
        </p>
        <p>
          From time-to-time we may update this Tool and these Terms. Your use of this Tool after
          we post any changes to these Terms constitutes your agreement to those changes
          prospectively from the date of such changes. You agree to review these Terms periodically
          to ensure that you are familiar with the most recent version. Action for Children may, in
          its sole discretion, and at any time, discontinue this Tool or any part, with or without
          notice, or may prevent your use of this Tool with or without notice to you. You agree
          that you do not have any rights in this Tool and that Action for Children will have no
          liability to you if this Tool is discontinued or your ability to access the Tool or any
          content you may have submitted on the Tool is terminated. You further agree that Action
          for Children will not be liable for any modification or suspension of the Tool.
        </p>

        <h2>Action for Children Online Content</h2>
        <p>The Tool contains a variety of:</p>
        <ul>
          <li>
            Materials and other items relating to Action for Children and its products and
            services, and similar items from our licensors and other third parties, including all
            layout, information, articles, posts, text, data, files, images, scripts, designs,
            graphics, button icons, instructions, illustrations, photographs, pictures, advertising
            copy, URLs, technology, software, interactive features, the "look and feel" of the
            Service, and the compilation, assembly, and arrangement of the materials of the Service
            and any and all copyrightable material (including source and object code);
          </li>
          <li>
            Trademarks, logos, trade names, trade dress, service marks, and trade identities of
            various parties, including those of Ohio Legal Help (collectively, "Trademarks"); and
          </li>
          <li>
            Other forms of intellectual property (all of the foregoing, collectively "Content").
          </li>
        </ul>
        <p>
          The Content is owned or controlled by Action for Children and our licensors and certain
          other third parties. All rights, titles, and interest in and to the Content available via
          the Service is the property of Action for Children or our licensors or certain other
          third parties, and is protected by U.S. and international copyright, trademark, trade
          dress, patent and/or other intellectual property and other rights and laws to the fullest
          extent possible. Action for Children owns the copyright in the selection, compilation,
          assembly, arrangement, and enhancement of the Content on the Tool.
        </p>
        <p>
          You agree not to download, display or use any Content located on the Tool for use in any
          commercial purpose, in connection with products or services that are not those of Action
          for Children, in any manner that is likely to cause confusion among consumers, that
          disparages Action for Children and/or its licensors, that dilutes the strength of Action
          for Children's or its licensor's property, or that infringes Action for Children's or
          its licensors' intellectual property rights. You further agree to not misuse the Content
          or third-party content that appears on this Tool.
        </p>
        <p>
          If you are a trademark or copyright owner and you believe that your trademark or
          copyright rights have been violated, please contact Action for Children.
        </p>

        <h2>Information Not Legal Advice</h2>
        <p>
          The information on this Tool, including information and material provided via the
          ShareCare service with or without using automated documents, is not legal advice. Legal
          information is not the same as legal advice, which is the application of law to an
          individual's specific circumstances.
        </p>
        <p>
          The information on this Tool is not a substitute for and does not replace the advice or
          representation of a licensed attorney. Although Action for Children goes to great lengths
          to make sure the information on the Tool is accurate and up to date, we make no claim as
          to the accuracy of this information and are not responsible for any consequences that may
          result from the use of this Tool.
        </p>
        <p>
          We recommend that you consult with a licensed lawyer if you want assurance that the
          information on the Tool and your interpretation of it are appropriate for your particular
          situation.
        </p>
        <p>
          You should not and are not authorized to rely on this Tool as a source of legal advice.
          The use of this Tool does not create an attorney-client relationship between Action for
          Children and any user.
        </p>
        <p>
          The Tool provides automated document assembly based strictly on information and
          selections provided by the user. The Tool is a clerical processing aid and does not
          evaluate, audit, or guarantee that any generated parenting plan complies with the Ohio
          Revised Code, local court rules, or any other applicable statutory requirements.
        </p>
        <p>
          The User expressly acknowledges that the Tool does not perform any legal analysis of
          whether a proposed plan serves the "best interest of the child" as defined by Ohio law.
          It remains the sole responsibility of the user to ensure that any document generated
          through the Tool meets the specific legal standards and welfare requirements of their
          jurisdiction. The generated output should be reviewed by qualified legal counsel prior to
          filing or execution.
        </p>
        <p>
          The final document output from this tool is a draft, is not binding, and must still be
          approved by a Judge, Magistrate, or the Court.
        </p>

        <h2>Use of the Tool</h2>
        <p>You agree that you will not:</p>
        <ul>
          <li>
            Use the Tool for any political or commercial purpose (including, without limitation,
            for purposes of advertising, soliciting funds, collecting product prices, and selling
            products);
          </li>
          <li>Use any meta tags or any other "hidden text" utilizing any Trademarks;</li>
          <li>
            Engage in any activities through or in connection with the Tool that seek to attempt
            to or do harm any individuals or entities or are unlawful, offensive, obscene, lewd,
            lascivious, filthy, violent, threatening, harassing, or abusive, or that violate any
            right of any third party, or are otherwise objectionable to Action for Children;
          </li>
          <li>
            Reverse engineer, decompile, disassemble, reverse assemble, or modify any Tool source
            or object code or any software or other products, services, or processes accessible
            through any portion of the Tool;
          </li>
          <li>
            Engage in any activity that interferes with a user's access to the Tool or the proper
            operation of the Tool, or otherwise causes harm to the Tool, Action for Children, or
            other users of the Tool;
          </li>
          <li>
            Interfere with or circumvent any security feature of the Tool or any feature that
            restricts or enforces limitations on use of or access to the Tool;
          </li>
          <li>
            Attempt to gain unauthorized access to the Tool, other computer systems or networks
            connected to the Tool, through password mining or any other means; or
          </li>
          <li>Otherwise violate these Terms.</li>
        </ul>
        <p>Without limiting the restrictions above, you also agree that, in using the Tool, you:</p>
        <ul>
          <li>
            Will not monitor, gather, copy, or distribute the Content on the Tool by using any
            robot, rover, "bot", spider, scraper, crawler, spyware, engine, device, software,
            extraction Tool, or any other automatic device, utility, or manual process of any kind;
          </li>
          <li>
            Will not frame or utilize framing techniques to enclose any such Content (including
            any images, text, or page layout);
          </li>
          <li>
            Will keep intact all Trademark, copyright, and other intellectual property notices
            contained in such Content;
          </li>
          <li>
            Will not use such Content in a manner that suggests an unauthorized association with
            any of our or our licensors' products, services, or brands;
          </li>
          <li>Will not make any modifications to such Content;</li>
          <li>
            Will not copy, modify, reproduce, archive, sell, lease, rent, exchange, create
            derivative works from, publish by hard copy or electronic means, publicly perform,
            display, disseminate, distribute, broadcast, retransmit, circulate or transfer to any
            third party or on any third party application or website, or otherwise use or exploit
            such Content in any way for any purpose except with the prior written consent of an
            officer of Action for Children or, in the case of Content from a licensor, the owner
            of the Content; and
          </li>
          <li>
            Will not insert any code or product to manipulate such Content in any way that
            adversely affects any user experience of the Tool.
          </li>
        </ul>
        <p>
          Action for Children may immediately suspend or terminate the availability of the Tool
          and Content (and any elements and features of them), in whole or part, for any reason,
          in Action for Children's sole discretion, and without advance notice or liability.
        </p>
        <p>
          The use of the Tool on a mobile device requires use of a mobile device and wireless
          mobile data service, which must be obtained from your wireless carrier, and may require
          internet access, which must be obtained from your service provider. You are responsible
          for obtaining and paying for such additional services and obtaining a suitable device,
          including without limitation all related usage charges.
        </p>
        <p>
          You may be required to send and receive, at your cost, electronic communications related
          to the Tool. If you do not have an unlimited wireless mobile data plan, you may incur
          additional charges from your wireless service provider related to your use of the Tool.
          You are solely responsible for obtaining any additional subscription or connectivity
          services or equipment necessary to access the Tool, including but not limited to payment
          of all third party fees, including fees for information sent to or through the Tool.
        </p>

        <h2>Accounts, Security, Passwords</h2>
        <p>
          Certain areas of the Tool may require registration or may otherwise ask you to provide
          information to participate in certain features or access certain content. The decision to
          provide this information is purely optional; however, if you elect not to provide such
          information, you may not be able to access certain content or participate in certain
          features of the Tool.
        </p>
        <p>
          If the Tool requires you to open an account, you must complete the specified registration
          process by providing us with current, complete, and accurate information as requested by
          the applicable online registration form. It is your responsibility to maintain the
          currency, completeness, and accuracy of your registration data and any loss caused by
          your failure to do so is your responsibility. After you have fully completed the
          registration form, you may be asked to choose a password and a username. It is your
          responsibility to maintain the confidentiality of your password and account.
          Additionally, you are entirely responsible for any and all activities that occur under
          your account. You agree to notify Action for Children immediately of any unauthorized use
          of your account. You further agree not to email, post, or otherwise disseminate any user
          ID, password, or other information which provides you access to the Tool. Action for
          Children is not liable for any loss that you may incur due to someone else using your
          password or account, either with or without your knowledge. You may close your account
          at any time.
        </p>

        <h2>Indemnification</h2>
        <p>
          You agree to indemnify and hold Action for Children and its parents, subsidiaries,
          officers, employees, agents, and website contractors and each of their officers,
          employees and agents harmless from any claims, damages and expenses, including reasonable
          attorneys' fees and costs, related to your violation of these Terms, or any violations
          thereof by your dependents, or which otherwise arises from your use of the Tool.
        </p>

        <h2>Representations and Limitations of Liability</h2>
        <p>
          Action for Children makes no representations about the accuracy of the information on
          this Tool or the reliability of the features of this Tool, the Content, or any other
          Tool feature. Action for Children disclaims all liability in the event of any service
          failure. You acknowledge that any reliance on such material or systems will be at your
          own risk. Action for Children makes no representations regarding the amount of time that
          any Content will be preserved.
        </p>
        <p>
          Action for Children does not endorse, verify, evaluate or guarantee any information
          provided by users and nothing shall be considered as an endorsement, verification or
          guarantee of any Content. You shall not create or distribute information, including but
          not limited to advertisements, press releases or other marketing materials, or include
          links to any sites which contain or suggest an endorsement by Action for Children without
          the prior review and written approval of Action for Children.
        </p>
        <p>
          This Tool (including, without limitation, all information and content contained hereon)
          is provided on an "as is, as available" basis. No warranties, express or implied,
          including but not limited to those of merchantability or fitness for a particular
          purpose, are made with respect to this tool or any information or software therein.
          Under no circumstances, including negligence, shall Action for Children be liable for
          any direct, indirect, incidental, special, punitive, or consequential damages that result
          from the use of or inability to use this Tool, nor shall Action for Children be
          responsible for any damages whatsoever that result from mistakes, omissions,
          interruptions, deletion of files, errors, defects, delays in operation or transmission,
          or any failure of performance whether or not caused by events beyond Action for
          Children's reasonable control, including but not limited to acts of God, communications
          line failure, theft, destruction, or unauthorized access to this Tool's records,
          programs, or services. Under no circumstances, including but not limited to a negligent
          act, will Action for Children or its affiliates or agents be liable for any damage of
          any kind that results from the use of, or the inability to use, the Tool, even if Action
          for Children has been advised of the possibility of such damages. Some jurisdictions do
          not allow the limitation or exclusion of liability for incidental or consequential
          damages; as a result, the above limitation or exclusion may not apply to you.
        </p>
        <p>
          The Tool may contain facts, opinions, views, statements, and recommendations of third
          party individuals and organizations. Action for Children does not represent or endorse
          the accuracy, timeliness or reliability of any such content. You acknowledge that any
          reliance upon any such content is at your sole risk. In no event will Action for Children
          or any affiliates be liable to you or anyone else for loss or injury, including, without
          limitation, death or personal injury.
        </p>
        <p>
          This Tool provides automated document assembly based strictly on the information you
          provide. This Tool does not evaluate whether your proposed plan complies with Ohio law
          or determine if a plan is in the "best interest of the child." It is your responsibility
          to ensure your documents meet legal standards. We strongly recommend having any generated
          output reviewed by a qualified legal professional before filing it with a court.
        </p>
        <p>
          To the fullest extent permitted by law, Action for Children and its agents are not
          responsible for any loss, injury, or damage (including personal injury) arising from your
          use of this Tool or the information contained within it. In jurisdictions that do not
          allow the exclusion of certain liabilities, our liability will be limited to the maximum
          extent permitted by law.
        </p>

        <h2>Third Party Websites</h2>
        <p>
          This Tool may link to sites and platforms not maintained by or related to Action for
          Children. Links are provided as a resource to users and are not sponsored by or
          affiliated with this Tool or Action for Children, and Action for Children makes no
          representations about the content or accuracy of those third party sites. The information
          you submit at a third party site accessible from this Tool is subject to the terms of
          that site's privacy policy.
        </p>

        <h2>Language Translation</h2>
        <p>
          The Tool Content has been translated for your convenience using a translation process
          powered by Google Translate™. Google Translate™ translations are done by an automated
          computer process, not a certified professional translator. For that reason, the
          translations may be inaccurate, incomplete, or unreliable. Use Google Translate™
          translations carefully.
        </p>
        <p>
          The translations are provided "as is" without warranties of any kind. Some content (such
          as images, videos, Flash, etc.) may not be able to be translated accurately (or
          translated at all) due to the limitations of the translation software.
        </p>
        <p>
          Action for Children is not responsible for incomplete or inaccurate translations, nor is
          it liable for any damages or losses arising out of the user's use of Google Translate™
          translations (or any other translations on this Tool). Action for Children does not
          endorse using Google™ Translate.
        </p>
        <p>
          Google disclaims all warranties related to the translations, express or implied,
          including any warranties of accuracy, reliability, and any implied warranties of
          merchantability, fitness for a particular purpose and noninfringement.
        </p>

        <h2>Miscellaneous</h2>
        <p>
          Both you and Action for Children acknowledge and agree that no partnership is formed and
          neither of you has the power or the authority to obligate or bind the other.
        </p>
        <p>
          These Terms will be governed by and construed in accordance with the internal laws of
          Ohio without regard to conflicts of laws principles. By using this site, you hereby agree
          that any and all disputes regarding these Terms will be resolved in Franklin County,
          Ohio. These Terms operate to the fullest extent permissible by law.
        </p>
        <p>
          You may be given the ability to provide us with personally identifiable information.
          Please read our{' '}
          <button
            className="static-page__back"
            style={{ display: 'inline', margin: 0, fontSize: 'inherit' }}
            onClick={() => navigate('/privacy-policy')}
          >
            Privacy Policy
          </button>{' '}
          for more information about our information collection and use practices, which Policy
          applies to information you submit on this Tool, and you hereby agree to the terms of
          that Policy.
        </p>
        <p>
          The failure of Action for Children to comply with these Terms because of an act of God,
          war, fire, riot, terrorism, earthquake, actions of federal, state or local governmental
          authorities or for any other reason beyond the reasonable control of Action for Children,
          shall not be deemed a breach of these Terms.
        </p>
        <p>
          If Action for Children fails to act with respect to your breach or anyone else's breach
          on any occasion, Action for Children is not waiving its right to act with respect to
          future or similar breaches. If any provision of these Terms shall be unlawful, void or
          for any reason unenforceable, then that provision shall be deemed severable from these
          terms of use and shall not affect the validity and enforceability of any remaining
          provisions.
        </p>
        <p>
          These Terms constitute a binding agreement between you and Action for Children and you
          agree to its terms upon your use of the Tool. These Terms constitute the entire agreement
          between you and Action for Children regarding the use of the Tool. By using the Tool, you
          represent that you are capable of entering into a binding agreement and that you agree to
          be bound by these Terms.
        </p>
        <p>
          You acknowledge and agree that your acceptance of these Terms and your use of the Tool
          constitutes your "electronic signature" indicating your desire to use the Tool. Your
          "electronic signature" indicates your acceptance of this Agreement, and your consent to
          receive communications about this Agreement electronically.
        </p>

        <h2>More Questions?</h2>
        <p>
          If you have additional questions you can reach us by email at{' '}
          <a href="mailto:info@actionforchildren.org">info@actionforchildren.org</a>. You can
          write to us at:
        </p>
        <address>
          Action for Children<br />
          105 Schrock Rd, Suite 125<br />
          Columbus, OH 43229
        </address>
        <p>
          Please include your email address, name, address, and telephone number when you contact
          us. This helps us answer you.
        </p>
      </div>
    </div>
  );
}
